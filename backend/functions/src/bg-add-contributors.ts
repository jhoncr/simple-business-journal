import { HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import * as z from 'zod';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';
import { JOURNAL_COLLECTION } from './common/const';
import { docIdSchema, ROLES } from './common/schemas/common_schemas';
import { JournalSchemaType } from './common/schemas/JournalSchema';
import { createAuditedCallable } from './helpers/audited-function';
import {
  escapeEmailKey,
  findPendingAccessKey,
  normalizeEmail,
} from './helpers/email-utils';

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

const updateShareRequest = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .transform((value) => normalizeEmail(value)),
    role: z.enum(ROLES),
    operation: z.enum(['add', 'remove']),
    jid: docIdSchema,
  })
  .strict();

export const addContributor = createAuditedCallable(
  'addContributor',
  JOURNAL_COLLECTION,
  ['admin'],
  updateShareRequest,
  async (request) => {
    try {
      logger.info('addContributor called');

      const data = request.data;
      const journalId = data.jid;
      const callerUid = request.auth!.uid;

      await db.runTransaction(async (transaction) => {
        const logDocRef = db.collection(JOURNAL_COLLECTION).doc(journalId);
        const logDoc = await transaction.get(logDocRef);

        if (!logDoc.exists) {
          throw new HttpsError('not-found', 'Journal not found or no access.');
        }

        const logData = logDoc.data() as JournalSchemaType;
        if (logData.isActive === false) {
          throw new HttpsError('permission-denied', 'This journal is not active.');
        }

        const callerRole =
          logData.access && Object.prototype.hasOwnProperty.call(logData.access, callerUid) ?
            logData.access[callerUid]?.role :
            undefined;
        if (callerRole !== 'admin') {
          throw new HttpsError(
            'permission-denied',
            'Only administrators can manage contributors.',
          );
        }

        if (data.operation === 'add') {
          handleAddOperation(transaction, logDocRef, data, logData);
        } else if (data.operation === 'remove') {
          handleRemoveOperation(transaction, logDocRef, data, logData);
        }
      });

      return {
        id: journalId,
        response: { result: 'ok', message: 'operation completed successfully' },
      };
    } catch (error) {
      logger.error('Error updating contributors', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        'internal',
        'Error updating contributors. Please try again later.',
      );
    }
  },
);

const handleAddOperation = (
  transaction: FirebaseFirestore.Transaction,
  logDocRef: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>,
  data: z.infer<typeof updateShareRequest>,
  logData: JournalSchemaType,
) => {
  const normalizedTargetEmail = normalizeEmail(data.email);
  const access = logData?.access ?? {};

  const cur = Object.entries(access).find(([, value]) => {
    return typeof value.email === 'string' &&
      normalizeEmail(value.email) === normalizedTargetEmail;
  });
  if (cur) {
    const [uid, contributorData] = cur;
    if (contributorData.role === 'admin') {
      logger.warn(
        `Attempt to change role of admin ${normalizedTargetEmail} was blocked.`,
      );
      throw new HttpsError(
        'permission-denied',
        'Cannot modify role of an administrator.',
      );
    }
    transaction.update(logDocRef, {
      [`access.${uid}.role`]: data.role,
      updatedAt: FieldValue.serverTimestamp(),
    });
    logger.info(`Updated role for ${normalizedTargetEmail} to ${data.role}.`);
    return;
  }

  const escapedEmail = escapeEmailKey(normalizedTargetEmail);
  const pendingAccess = logData?.pendingAccess ?? {};
  const existingKey = findPendingAccessKey(pendingAccess, normalizedTargetEmail);

  const updates: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
    [`pendingAccess.${escapedEmail}`]: data.role,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (existingKey && existingKey !== escapedEmail) {
    // Clean up legacy mixed-case key atomically while writing normalized key
    updates[`pendingAccess.${existingKey}`] = FieldValue.delete();
  }

  if (existingKey && pendingAccess[existingKey] !== data.role) {
    logger.info(
      `Updating role for ${normalizedTargetEmail} in pendingAccess to ${data.role}.`,
    );
  } else if (!existingKey) {
    logger.info(
      `Adding ${normalizedTargetEmail} to pendingAccess with role ${data.role}.`,
    );
  }

  transaction.update(logDocRef, updates);
};

const handleRemoveOperation = (
  transaction: FirebaseFirestore.Transaction,
  logDocRef: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>,
  data: z.infer<typeof updateShareRequest>,
  logData: JournalSchemaType,
) => {
  const normalizedTargetEmail = normalizeEmail(data.email);
  const access = logData?.access ?? {};
  const contributorEntry = Object.entries(access).find(
    ([, value]) =>
      typeof value.email === 'string' &&
      normalizeEmail(value.email) === normalizedTargetEmail,
  );

  if (contributorEntry) {
    const [uid, contributorData] = contributorEntry;

    if (contributorData.role === 'admin') {
      const adminCount = Object.values(access).filter(
        (c) => c.role === 'admin',
      ).length;
      if (adminCount <= 1) {
        throw new HttpsError('permission-denied', 'Cannot remove the sole admin.');
      }
    }

    transaction.update(logDocRef, {
      [`access.${uid}`]: FieldValue.delete(),
      access_array: FieldValue.arrayRemove(uid),
      updatedAt: FieldValue.serverTimestamp(),
    });
    logger.info(
      `Removed ${normalizedTargetEmail} (UID: ${uid}) from access and access_array.`,
    );
    return;
  }

  const pendingAccess = logData?.pendingAccess ?? {};
  const existingKey = findPendingAccessKey(pendingAccess, normalizedTargetEmail);
  if (existingKey) {
    transaction.update(logDocRef, {
      [`pendingAccess.${existingKey}`]: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    logger.info(`Removed ${normalizedTargetEmail} from pendingAccess.`);
    return;
  }

  logger.warn(
    `Attempted to remove ${normalizedTargetEmail}, but they were not found in access or pendingAccess.`,
  );
  throw new HttpsError(
    'not-found',
    'Contributor or pending invitation not found.',
  );
};
