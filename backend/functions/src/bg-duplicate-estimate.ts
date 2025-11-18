// backend/functions/src/bg-duplicate-estimate.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';
import { JOURNAL_COLLECTION, ROLES_THAT_ADD } from './common/const';
import { ENTRY_CONFIG, EntryType } from './common/schemas/configmap';
import { ALLOWED } from './lib/bg-consts';
import { EntryItf } from './common/common_types';
import * as z from 'zod';

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

// Schema for the duplicate estimate request
const duplicateEstimateSchema = z.object({
  journalId: z.string().min(1, 'Journal ID is required'),
  entryId: z.string().min(1, 'Entry ID is required'),
});

export const duplicateEstimate = onCall(
  {
    cors: ALLOWED,
    enforceAppCheck: true,
  },
  async (request) => {
    try {
      logger.info('duplicateEstimate called');

      if (!request.auth) {
        throw new HttpsError(
          'unauthenticated',
          'You must be signed in to duplicate an estimate',
        );
      }

      const requestResult = duplicateEstimateSchema.safeParse(request.data);
      if (!requestResult.success) {
        logger.error('Invalid request data format:', {
          error: requestResult.error.format(),
        });
        throw new HttpsError(
          'invalid-argument',
          `Invalid request data: ${requestResult.error.message}`,
        );
      }

      const { journalId, entryId } = requestResult.data;
      const uid = request.auth.uid;

      // Get the main journal document to check access
      const journalDocRef = db.collection(JOURNAL_COLLECTION).doc(journalId);
      const journalDoc = await journalDocRef.get();

      if (!journalDoc.exists) {
        throw new HttpsError('not-found', 'Journal not found or no access.');
      }

      const journalData = journalDoc.data() || {};

      // Check if user has permission to add entries
      if (
        !Object.getOwnPropertyDescriptor(journalData?.access ?? {}, uid) ||
        !ROLES_THAT_ADD.has(journalData?.access?.[uid]?.role)
      ) {
        throw new HttpsError(
          'permission-denied',
          'No access to add entries to this journal.',
        );
      }

      // Get the estimate configuration
      const entryType: EntryType = 'estimate';
      const config = ENTRY_CONFIG[entryType];
      if (!config) {
        throw new HttpsError('internal', 'Estimate configuration not found');
      }

      const {
        subcollection: targetSubcollectionName,
        schema: estimateDetailsStateSchema,
      } = config;

      const entriesColRef = journalDocRef.collection(targetSubcollectionName);

      // Fetch the original estimate
      const originalEntryDoc = await entriesColRef.doc(entryId).get();
      if (!originalEntryDoc.exists) {
        throw new HttpsError('not-found', 'Original estimate not found.');
      }

      const originalEntry = originalEntryDoc.data() as EntryItf;

      // Log the original entry structure for debugging
      logger.info(
        'Original entry details (stringified):',
        JSON.stringify(originalEntry.details, null, 2),
      );

      // Validate using the flexible schema
      const detailsResult = estimateDetailsStateSchema
        .passthrough()
        .safeParse(originalEntry.details);

      if (!detailsResult.success) {
        logger.error('Original estimate has invalid details:', {
          error: detailsResult.error.format(),
        });
        logger.error('Original details data:', {
          details: originalEntry.details,
        });
        throw new HttpsError(
          'invalid-argument',
          'Original estimate has invalid data structure',
        );
      }

      const originalDetails = detailsResult.data;

      // Create the duplicate estimate details - preserve the original structure
      // but clear certain fields that shouldn't be inherited
      const duplicateDetails = {
        ...originalDetails,
        // Clear payments if any (duplicates shouldn't inherit payments)
        payments: [],
        // Optionally reset status to DRAFT (uncomment if desired)
        // status: WorkStatus.DRAFT,
      };

      // Generate name for the duplicate
      const duplicateName = originalEntry.name;

      // Create the duplicate entry
      const duplicateEntry: Omit<EntryItf, 'createdAt' | 'updatedAt'> = {
        name: duplicateName,
        isActive: true,
        createdBy: uid,
        details: {
          ...duplicateDetails,
          notes: `${
            originalDetails.notes ?
              `${originalDetails.notes}
` :
              ''
          } \n(Copied from ${entryId})`,
        },
      };

      // Add the duplicate entry to Firestore
      const docRef = await entriesColRef.add({
        ...duplicateEntry,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      logger.info(
        `Estimate duplicated successfully. Original: ${entryId}, Duplicate: ${docRef.id}`,
      );

      return {
        result: 'ok',
        message: 'Estimate duplicated successfully',
        id: docRef.id,
        originalId: entryId,
      };
    } catch (error) {
      logger.error('Error in duplicateEstimate: ', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        'internal',
        'An unexpected error occurred while duplicating the estimate. Please try again later.',
      );
    }
  },
);
