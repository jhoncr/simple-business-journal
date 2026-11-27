import { HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';
import { JOURNAL_COLLECTION, JOURNAL_TYPES } from './common/const';
import {
  JournalSchema,
  businessDetailsSchema,
} from './common/schemas/JournalSchema';
import { docIdSchema } from './common/schemas/common_schemas';
import * as z from 'zod';
import { createAuditedCallable } from './helpers/audited-function';
import { flattenToDotNotation } from './helpers/object-utils';
import { normalizeEmail } from './helpers/email-utils';

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

const titleSchema = z.string().min(1).max(120);

const _CreateJournalPayloadSchema = JournalSchema.omit({
  id: true,
  access: true,
  access_array: true,
  pendingAccess: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  deletedBy: true,
  isActive: true,
}).extend({
  title: titleSchema,
  details: businessDetailsSchema,
});

const CreateJournalPayloadSchema = _CreateJournalPayloadSchema.refine(
  (data) => {
    return (
      data.journalType === JOURNAL_TYPES.BUSINESS &&
      businessDetailsSchema.safeParse(data.details).success
    );
  },
  {
    message: 'Details must match the specified journal type.',
    path: ['details'],
  },
);

export const createJournal = createAuditedCallable(
  'createJournal',
  JOURNAL_COLLECTION,
  [],
  CreateJournalPayloadSchema,
  async (request) => {
    const uid = request.auth!.uid;
    const authEmail = request.auth!.token.email;
    const access = {
      [uid]: {
        role: 'admin',
        email: typeof authEmail === 'string' ? normalizeEmail(authEmail) : '',
        displayName: request.auth!.token.name || null,
        photoURL: request.auth!.token.picture || null,
      },
    };

    const { title, journalType, details } = request.data;

    try {
      const journalDocRef = db.collection(JOURNAL_COLLECTION).doc();

      await journalDocRef.set({
        title,
        journalType,
        details,
        access,
        access_array: [uid],
        isActive: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      logger.info(
        `Journal of type ${journalType} created successfully with ID: ${journalDocRef.id}`,
      );
      return {
        id: journalDocRef.id,
        response: { journalId: journalDocRef.id },
      };
    } catch (error: unknown) {
      logger.error('Journal creation failed', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError(
        'internal',
        'Journal creation failed. Please try again later.',
      );
    }
  },
  { isCreateOperation: true },
);

export const UpdateJournalPayloadSchema = z.object({
  jid: docIdSchema,
  title: titleSchema.optional(),
  details: businessDetailsSchema.deepPartial().optional(),
});

/**
 * Builds the Firestore update payload for `updateJournal`, preserving explicit
 * `details.logo = null` (instead of deleting the key) so it remains valid against
 * `businessDetailsSchema`. Exported for unit tests.
 */
export function buildJournalUpdatePayload(
  title: string | undefined,
  details: z.infer<typeof UpdateJournalPayloadSchema>['details'],
): Record<string, unknown> {
  const updateData: Record<string, unknown> = {};
  if (title !== undefined) updateData.title = title;
  if (details !== undefined) {
    const flattenedDetails = flattenToDotNotation(
      details as Record<string, unknown>,
      'details',
    );
    Object.assign(updateData, flattenedDetails);
    if (details.logo === null) {
      updateData['details.logo'] = null;
    }
  }
  return updateData;
}

export const updateJournal = createAuditedCallable(
  'updateJournal',
  JOURNAL_COLLECTION,
  ['admin'],
  UpdateJournalPayloadSchema,
  async (request) => {
    const { jid: journalId, title, details } = request.data;
    const uid = request.auth!.uid;

    try {
      const docRef = db.collection(JOURNAL_COLLECTION).doc(journalId);
      const updateData = buildJournalUpdatePayload(title, details);

      await db.runTransaction(async (transaction) => {
        const journalDoc = await transaction.get(docRef);
        if (!journalDoc.exists) {
          throw new HttpsError('not-found', 'Journal not found.');
        }
        const journalData = journalDoc.data() || {};
        if (journalData.isActive === false) {
          throw new HttpsError(
            'permission-denied',
            'This journal is not active.',
          );
        }
        const accessMap = journalData.access as Record<string, { role?: string }> | undefined;
        const userRole =
          accessMap && Object.prototype.hasOwnProperty.call(accessMap, uid) ?
            accessMap[uid]?.role :
            undefined;
        if (userRole !== 'admin') {
          throw new HttpsError(
            'permission-denied',
            'Only administrators can update journal settings.',
          );
        }

        if (Object.keys(updateData).length > 0) {
          transaction.update(docRef, {
            ...updateData,
            updatedAt: FieldValue.serverTimestamp(),
          });
          logger.info(`Journal ${journalId} updated successfully.`);
        } else {
          logger.info(`No changes detected for journal ${journalId}.`);
        }
      });

      return { id: journalId, response: { success: true } };
    } catch (error: unknown) {
      logger.error('Update failed', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError(
        'internal',
        'Failed to update journal. Please try again later.',
      );
    }
  },
);
