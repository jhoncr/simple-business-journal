import { HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';
import * as z from 'zod';
import { JOURNAL_COLLECTION, ROLES_CAN_DELETE } from './common/const';
import { ENTRY_CONFIG, EntryType } from './common/schemas/configmap';
import { createAuditedCallable } from './helpers/audited-function';

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

// --- Schema for deleteJournal ---
const deleteJournalSchema = z.object({
  jid: z.string().min(1),
});

export const deleteJournal = createAuditedCallable(
  'deleteJournal',
  JOURNAL_COLLECTION,
  [], // Custom role check below using ROLES_CAN_DELETE
  deleteJournalSchema,
  async (request) => {
    logger.info('deleteJournal called');
    try {
      const uid = request.auth!.uid;
      const data = request.data as z.infer<typeof deleteJournalSchema>;

      const { jid: journalId } = data;
      const journalRef = db.collection(JOURNAL_COLLECTION).doc(journalId);
      const journalDoc = await journalRef.get();

      if (!journalDoc.exists) {
        throw new HttpsError('not-found', 'Journal not found.');
      }

      const journalData = journalDoc.data();
      if (!journalData) {
        throw new HttpsError('internal', 'Journal data is empty.');
      }

      // --- Check permissions using ROLES_CAN_DELETE ---
      const access = journalData.access;
      if (!access || !access[uid] || !ROLES_CAN_DELETE.has(access[uid].role)) {
        logger.warn(
          `User ${uid} does not have permission to delete journal ${journalId}. Role: ${access?.[uid]?.role}`,
        );
        throw new HttpsError(
          'permission-denied',
          'You do not have permission to delete this journal.',
        );
      }

      // --- Soft delete the main journal document ---
      await journalRef.update({
        isActive: false,
        deletedAt: FieldValue.serverTimestamp(),
        deletedBy: uid,
        updatedAt: FieldValue.serverTimestamp(), // Add updatedAt
      });

      logger.info(`Journal ${journalId} marked as deleted by user ${uid}.`);

      // --- REMOVED logic to delete children documents ---

      return {
        id: journalId,
        response: { message: 'Journal deleted successfully.' }
      };
    } catch (error) {
      logger.error('deleteJournal error:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        'internal',
        'An error occurred while deleting the journal.',
      );
    }
  },
);

// --- Schema for deleteEntry ---
const deleteEntrySchema = z.object({
  jid: z.string().min(1),
  entryId: z.string().min(1),
  entryType: z.enum(Object.keys(ENTRY_CONFIG) as [string, ...string[]]),
});

export const deleteEntry = createAuditedCallable(
  'deleteEntry',
  JOURNAL_COLLECTION,
  [], // Custom role check below
  deleteEntrySchema,
  async (request) => {
    logger.info('deleteEntry called');
    try {
      const uid = request.auth!.uid;
      const data = request.data as z.infer<typeof deleteEntrySchema>;

      const { jid: journalId, entryId, entryType } = data;

      // --- Get journal to check permissions ---
      const journalRef = db.collection(JOURNAL_COLLECTION).doc(journalId);
      const journalDoc = await journalRef.get();

      if (!journalDoc.exists) {
        throw new HttpsError('not-found', 'Parent journal not found.');
      }
      const journalData = journalDoc.data();
      if (!journalData) {
        throw new HttpsError('internal', 'Journal data is empty.');
      }

      // --- Check permissions using ROLES_CAN_DELETE ---
      const access = journalData.access;
      if (!access || !access[uid] || !ROLES_CAN_DELETE.has(access[uid].role)) {
        logger.warn(
          `User ${uid} does not have permission to delete entry` +
            `${entryId} in journal ${journalId}. Role: ${access?.[uid]?.role}`,
        );
        throw new HttpsError(
          'permission-denied',
          'You do not have permission to delete this entry.',
        );
      }

      // --- Determine target subcollection ---
      const config = ENTRY_CONFIG[entryType as EntryType]; // Type assertion
      if (!config) {
        throw new HttpsError(
          'invalid-argument',
          `Invalid entryType: ${entryType}`,
        );
      }
      const targetSubcollectionName = config.subcollection;

      const entryRef = journalRef
        .collection(targetSubcollectionName)
        .doc(entryId);

      // Check if entry exists before updating
      const entryDoc = await entryRef.get();
      if (!entryDoc.exists) {
        throw new HttpsError(
          'not-found',
          `Entry ${entryId} not found in ${targetSubcollectionName}.`,
        );
      }

      await entryRef.update({
        isActive: false,
        deletedAt: FieldValue.serverTimestamp(),
        deletedBy: uid,
        updatedAt: FieldValue.serverTimestamp(), // Add updatedAt
      });

      logger.info(
        `Entry ${entryId} (${entryType}) in journal ${journalId} marked as deleted by user ${uid}.`,
      );
      return {
        id: journalId,
        response: { message: 'Entry deleted successfully.' }
      };
    } catch (error) {
      logger.error('deleteEntry error:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        'internal',
        'An error occurred while deleting the entry.',
      );
    }
  },
);
