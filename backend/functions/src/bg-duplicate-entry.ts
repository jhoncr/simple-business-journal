// backend/functions/src/bg-duplicate-entry.ts
import { HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';
import { JOURNAL_COLLECTION } from './common/const';
import { ENTRY_CONFIG, EntryType } from './common/schemas/configmap';
import { docIdSchema } from './common/schemas/common_schemas';
import { createAuditedCallable } from './helpers/audited-function';
import { EntryItf } from './common/common_types';
import { handleSchemaValidationError } from './lib/bg-consts';
import * as z from 'zod';

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

// Schema for the duplicate entry request
const duplicateEntrySchema = z.object({
  jid: docIdSchema,
  entryId: docIdSchema,
  entryType: z.enum(Object.keys(ENTRY_CONFIG) as [string, ...string[]]),
});

export const duplicateEntry = createAuditedCallable(
  'duplicateEntry',
  JOURNAL_COLLECTION,
  [], // Custom transactional role check below
  duplicateEntrySchema,
  async (request) => {
    try {
      logger.info('duplicateEntry called');

      const { jid: journalId, entryId, entryType } = request.data;
      const uid = request.auth!.uid;

      const config = ENTRY_CONFIG[entryType as EntryType];
      if (!config) {
        throw new HttpsError(
          'invalid-argument',
          `Unsupported entryType: ${entryType}`,
        );
      }

      const { allowedRoles, subcollection: targetSubcollectionName } = config;
      const journalDocRef = db.collection(JOURNAL_COLLECTION).doc(journalId);
      const entriesColRef = journalDocRef.collection(targetSubcollectionName);
      const originalDocRef = entriesColRef.doc(entryId);
      const newDocRef = entriesColRef.doc();
      const newDocId = newDocRef.id;

      await db.runTransaction(async (transaction) => {
        const journalDoc = await transaction.get(journalDocRef);
        if (!journalDoc.exists) {
          throw new HttpsError('not-found', 'Journal not found or no access.');
        }

        const journalData = journalDoc.data() || {};
        if (journalData.isActive === false) {
          throw new HttpsError('permission-denied', 'This journal is not active.');
        }

        const accessMap = journalData.access as Record<string, { role?: string }> | undefined;
        const userRole =
          accessMap && Object.prototype.hasOwnProperty.call(accessMap, uid) ?
            accessMap[uid]?.role :
            undefined;
        if (!userRole || !(allowedRoles as readonly string[]).includes(userRole)) {
          throw new HttpsError(
            'permission-denied',
            'No access to add entries to this journal.',
          );
        }

        const originalEntryDoc = await transaction.get(originalDocRef);
        if (!originalEntryDoc.exists) {
          throw new HttpsError('not-found', 'Original entry not found.');
        }

        const originalEntry = originalEntryDoc.data() as EntryItf;
        if (originalEntry.isActive === false) {
          throw new HttpsError(
            'failed-precondition',
            'Cannot duplicate a deleted entry.',
          );
        }

        const duplicateDetails: Record<string, unknown> = {
          ...(originalEntry.details || {}),
        };

        if (entryType === 'estimate') {
          // Clear payments for estimates
          duplicateDetails.payments = [];

          // Safe note truncation to respect max 250 character constraint
          const MAX_NOTES_LENGTH = 250;
          const annotation = `\n(Copied from ${entryId})`;
          const rawNotes = originalEntry.details?.notes;
          const origNotes = typeof rawNotes === 'string' ? rawNotes.trim() : '';

          if (origNotes) {
            const maxOrigLength = Math.max(0, MAX_NOTES_LENGTH - annotation.length);
            const truncatedNotes =
              origNotes.length > maxOrigLength ?
                origNotes.slice(0, maxOrigLength) :
                origNotes;
            duplicateDetails.notes = `${truncatedNotes}${annotation}`;
          } else {
            duplicateDetails.notes = `(Copied from ${entryId})`.slice(
              0,
              MAX_NOTES_LENGTH,
            );
          }
        } else if (entryType === 'template') {
          duplicateDetails.id = newDocId;
          // Detach thumbnail so the duplicate does not alias the original's mutable Storage path
          delete duplicateDetails.thumbnailUrl;
        }

        // Generate name for the duplicate, capped at 254 chars
        const duplicateName = (
          originalEntry.name ? `${originalEntry.name} (Copy)` : 'Untitled (Copy)'
        ).slice(0, 254);
        duplicateDetails.name = duplicateName;

        // Validate duplicate details against entry schema before persisting
        const detailsResult = config.schema.safeParse(duplicateDetails);
        if (!detailsResult.success) {
          logger.error(
            `Validation failed when duplicating ${entryType} ${entryId} in journal ${journalId}:`,
            detailsResult.error,
          );
          handleSchemaValidationError(entryType, detailsResult);
        }
        const validatedDetails = detailsResult.data as Record<string, unknown>;

        const duplicateEntryData: Omit<EntryItf, 'createdAt' | 'updatedAt'> = {
          name: duplicateName,
          isActive: true,
          createdBy: uid,
          details: validatedDetails,
        };

        transaction.set(newDocRef, {
          ...duplicateEntryData,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      });

      logger.info(
        `${entryType} duplicated successfully. Original: ${entryId}, Duplicate: ${newDocId}`,
      );

      return {
        id: journalId,
        response: {
          result: 'ok',
          message: `${entryType} duplicated successfully`,
          id: newDocId,
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
