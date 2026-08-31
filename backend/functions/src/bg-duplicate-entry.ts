// backend/functions/src/bg-duplicate-entry.ts
import { HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';
import { JOURNAL_COLLECTION } from './common/const';
import { ENTRY_CONFIG, EntryType } from './common/schemas/configmap';
import { createAuditedCallable } from './helpers/audited-function';
import { EntryItf } from './common/common_types';
import * as z from 'zod';

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

// Schema for the duplicate entry request
const duplicateEntrySchema = z.object({
  jid: z.string().min(1, 'Journal ID is required'),
  entryId: z.string().min(1, 'Entry ID is required'),
  entryType: z.enum(Object.keys(ENTRY_CONFIG) as [string, ...string[]]),
});

export const duplicateEntry = createAuditedCallable(
  'duplicateEntry',
  JOURNAL_COLLECTION,
  [], // Custom role check below
  duplicateEntrySchema,
  async (request) => {
    try {
      logger.info('duplicateEntry called');

      const data = request.data as z.infer<typeof duplicateEntrySchema>;
      const { jid: journalId, entryId, entryType } = data;
      const uid = request.auth!.uid;

      // Get the main journal document to check access
      const journalDocRef = db.collection(JOURNAL_COLLECTION).doc(journalId);
      const journalDoc = await journalDocRef.get();

      if (!journalDoc.exists) {
        throw new HttpsError('not-found', 'Journal not found or no access.');
      }

      const journalData = journalDoc.data() || {};
      const config = ENTRY_CONFIG[entryType as EntryType];

      if (!config) {
        throw new HttpsError(
            'invalid-argument',
            `Unsupported entryType: ${entryType}`,
          );
      }

      const { allowedRoles, subcollection: targetSubcollectionName } = config;

      // Check if user has permission to add entries of this type
      if (
        !Object.getOwnPropertyDescriptor(journalData?.access ?? {}, uid) ||
        !allowedRoles.includes(journalData?.access?.[uid]?.role)
      ) {
        throw new HttpsError(
          'permission-denied',
          'No access to add entries to this journal.',
        );
      }

      const entriesColRef = journalDocRef.collection(targetSubcollectionName);

      // Fetch the original entry
      const originalEntryDoc = await entriesColRef.doc(entryId).get();
      if (!originalEntryDoc.exists) {
        throw new HttpsError('not-found', 'Original entry not found.');
      }

      const originalEntry = originalEntryDoc.data() as EntryItf;

      // Prepare details (clear specific fields based on type)
      const duplicateDetails = { ...originalEntry.details };

      if (entryType === 'estimate') {
        // Clear payments for estimates
        duplicateDetails.payments = [];
        duplicateDetails.notes = `${
            originalEntry.details.notes ?
              `${originalEntry.details.notes}\n` :
              ''
          } \n(Copied from ${entryId})`;
      }

      // Generate name for the duplicate
      const duplicateName = originalEntry.name + ' (Copy)';
      duplicateDetails.name = duplicateName;

      // Create the duplicate entry
      const duplicateEntryData: Omit<EntryItf, 'createdAt' | 'updatedAt'> = {
        name: duplicateName,
        isActive: true,
        createdBy: uid,
        details: duplicateDetails,
      };

      // Add the duplicate entry to Firestore
      const docRef = await entriesColRef.add({
        ...duplicateEntryData,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      logger.info(
        `${entryType} duplicated successfully. Original: ${entryId}, Duplicate: ${docRef.id}`,
      );

      return {
        id: journalId,
        response: {
          result: 'ok',
          message: `${entryType} duplicated successfully`,
          id: docRef.id,
          originalId: entryId,
        },
      };
    } catch (error) {
      logger.error('Error in duplicateEntry: ', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        'internal',
        'An unexpected error occurred while duplicating the entry. Please try again later.',
      );
    }
  },
);
