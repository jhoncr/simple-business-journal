import { HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import * as z from 'zod';
import { JOURNAL_COLLECTION, ROLES_CAN_DELETE } from './common/const';
import { ENTRY_CONFIG, EntryType } from './common/schemas/configmap';
import { docIdSchema } from './common/schemas/common_schemas';
import { createAuditedCallable } from './helpers/audited-function';

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

// --- Schema for deleteJournal ---
const deleteJournalSchema = z.object({
  jid: docIdSchema,
});

export const deleteJournal = createAuditedCallable(
  'deleteJournal',
  JOURNAL_COLLECTION,
  [], // Custom transactional role check below
  deleteJournalSchema,
  async (request) => {
    logger.info('deleteJournal called');
    try {
      const uid = request.auth!.uid;
      const { jid: journalId } = request.data;
      const journalRef = db.collection(JOURNAL_COLLECTION).doc(journalId);

      await db.runTransaction(async (transaction) => {
        const journalDoc = await transaction.get(journalRef);

        if (!journalDoc.exists) {
          throw new HttpsError('not-found', 'Journal not found.');
        }

        const journalData = journalDoc.data();
        if (!journalData) {
          throw new HttpsError('internal', 'Journal data is empty.');
        }

        // Only admin can delete a journal
        const access = journalData.access as Record<string, { role?: string }> | undefined;
        const userRole =
          access && Object.prototype.hasOwnProperty.call(access, uid) ?
            access[uid]?.role :
            undefined;
        if (userRole !== 'admin') {
          logger.warn(
            `User ${uid} does not have permission to delete journal ${journalId}. Role: ${userRole}`,
          );
          throw new HttpsError(
            'permission-denied',
            'Only administrators have permission to delete this journal.',
          );
        }

        if (journalData.isActive === false) {
          throw new HttpsError(
            'failed-precondition',
            'Journal is already deleted.',
          );
        }

        transaction.update(journalRef, {
          isActive: false,
          deletedAt: FieldValue.serverTimestamp(),
          deletedBy: uid,
          updatedAt: FieldValue.serverTimestamp(),
        });
      });

      logger.info(`Journal ${journalId} marked as deleted by user ${uid}.`);

      return {
        id: journalId,
        response: { message: 'Journal deleted successfully.' },
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
  jid: docIdSchema,
  entryId: docIdSchema,
  entryType: z.enum(Object.keys(ENTRY_CONFIG) as [string, ...string[]]),
});

export const deleteEntry = createAuditedCallable(
  'deleteEntry',
  JOURNAL_COLLECTION,
  [], // Custom transactional role check below
  deleteEntrySchema,
  async (request) => {
    logger.info('deleteEntry called');
    try {
      const uid = request.auth!.uid;
      const { jid: journalId, entryId, entryType } = request.data;

      const config = ENTRY_CONFIG[entryType as EntryType];
      if (!config) {
        throw new HttpsError(
          'invalid-argument',
          `Invalid entryType: ${entryType}`,
        );
      }
      const targetSubcollectionName = config.subcollection;
      const journalRef = db.collection(JOURNAL_COLLECTION).doc(journalId);
      const entryRef = journalRef.collection(targetSubcollectionName).doc(entryId);

      let templateThumbnailUrl: string | undefined;

      await db.runTransaction(async (transaction) => {
        const journalDoc = await transaction.get(journalRef);

        if (!journalDoc.exists) {
          throw new HttpsError('not-found', 'Parent journal not found.');
        }
        const journalData = journalDoc.data();
        if (!journalData) {
          throw new HttpsError('internal', 'Journal data is empty.');
        }
        if (journalData.isActive === false) {
          throw new HttpsError(
            'permission-denied',
            'This journal is not active.',
          );
        }

        const access = journalData.access as Record<string, { role?: string }> | undefined;
        const userRole =
          access && Object.prototype.hasOwnProperty.call(access, uid) ?
            access[uid]?.role :
            undefined;
        if (!userRole || !ROLES_CAN_DELETE.has(userRole)) {
          logger.warn(
            `User ${uid} does not have permission to delete entry ` +
              `${entryId} in journal ${journalId}. Role: ${userRole}`,
          );
          throw new HttpsError(
            'permission-denied',
            'You do not have permission to delete this entry.',
          );
        }

        const entryDoc = await transaction.get(entryRef);
        if (!entryDoc.exists) {
          throw new HttpsError(
            'not-found',
            `Entry ${entryId} not found in ${targetSubcollectionName}.`,
          );
        }

        const entryData = entryDoc.data() ?? {};
        if (entryData.isActive === false) {
          throw new HttpsError(
            'failed-precondition',
            'Entry is already deleted.',
          );
        }

        if (entryType === 'template' && typeof entryData.details?.thumbnailUrl === 'string') {
          templateThumbnailUrl = entryData.details.thumbnailUrl;
        }

        transaction.update(entryRef, {
          isActive: false,
          deletedAt: FieldValue.serverTimestamp(),
          deletedBy: uid,
          updatedAt: FieldValue.serverTimestamp(),
        });
      });

      // Best-effort cleanup of template thumbnail in Cloud Storage after soft-delete commits.
      if (entryType === 'template' && templateThumbnailUrl) {
        const expectedPrefix = `journals/${journalId}/templates/${entryId}/`;
        const storagePath = templateThumbnailUrl.replace(/^\/+/, '');
        if (storagePath.startsWith(expectedPrefix) && !storagePath.includes('..')) {
          try {
            await getStorage()
              .bucket()
              .file(storagePath)
              .delete({ ignoreNotFound: true });
            logger.info(`Deleted thumbnail ${storagePath} for template ${entryId}.`);
          } catch (storageError) {
            logger.warn(
              `Best-effort thumbnail cleanup failed for ${storagePath}; soft-delete already committed.`,
              storageError,
            );
          }
        }
      }

      logger.info(
        `Entry ${entryId} (${entryType}) in journal ${journalId} marked as deleted by user ${uid}.`,
      );
      return {
        id: journalId,
        response: { message: 'Entry deleted successfully.' },
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
