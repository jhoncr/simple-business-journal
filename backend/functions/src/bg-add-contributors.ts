import { HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import * as z from 'zod';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';
import { JOURNAL_COLLECTION } from './common/const';
import { ROLES } from './common/schemas/common_schemas';
import { JournalSchemaType } from './common/schemas/JournalSchema';
import { createAuditedCallable } from './helpers/audited-function';

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();


const updateShareRequest = z
  .object({
    email: z.string().email(),
    role: z.enum(ROLES),
    operation: z.enum(['add', 'remove']),
    jid: z.string(),
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

      const data = request.data as z.infer<typeof updateShareRequest>;
      const journalId = data.jid;

      await db.runTransaction(async (transaction) => {
        const logDocRef = db.collection(JOURNAL_COLLECTION).doc(journalId);
        const logDoc = await transaction.get(logDocRef);
        const logData = logDoc.data() as JournalSchemaType;

        if (data.operation === 'add') {
          handleAddOperation(
            transaction,
            logDocRef,
            data,
            logData,
          );
        } else if (data.operation === 'remove') {
          handleRemoveOperation(
            transaction,
            logDocRef,
            data,
            logData,
          );
        }
      });

      return {
        id: journalId,
        response: { result: 'ok', message: 'operation completed successfully' },
      };
    } catch (error) {
      logger.log('Error adding contributors', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        'internal',
        'Error adding contributors. Please try again later.',
      );
    }
  },
);

const handleAddOperation = async (
  transaction: FirebaseFirestore.Transaction,
  logDocRef: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>,
  data: z.infer<typeof updateShareRequest>,
  logData: JournalSchemaType,
) => {
  // check if the email is already in the access map, if so, only update the role
  const access = logData?.access ?? {};

  const cur = Object.entries(access).find(([key, value]) => {
    return value.email === data.email;
  });
  if (cur) {
    const [uid, contributorData] = cur;
    // If user is already an admin, prevent role change via this function.
    // Admin role changes should be handled by a dedicated admin management function.
    if (contributorData.role === 'admin') {
      logger.warn(
        `Attempt to change role of admin ${data.email} was blocked.`,
      );
      return; // Or throw an error: new HttpsError("permission-denied", "Cannot change admin role here.");
    }
    // Update the role for existing non-admin user
    transaction.update(logDocRef, {
      [`access.${uid}.role`]: data.role,
    });
    logger.info(`Updated role for ${data.email} to ${data.role}.`);
    return;
  }

  const escapedEmail = data.email.replace(/\./g, ',');
  // If the email is not in the access map, add it to pendingAccess map
  const pendingAccess = logData?.pendingAccess ?? {};
  // Avoid overwriting if email already in pendingAccess, update role instead
  if (pendingAccess[escapedEmail] && pendingAccess[escapedEmail] !== data.role) {
     logger.info(`Updating role for ${data.email} in pendingAccess to ${data.role}.`);
  } else if (!pendingAccess[escapedEmail]) {
    logger.info(`Adding ${data.email} to pendingAccess with role ${data.role}.`);
  }
  transaction.update(logDocRef, {
    [`pendingAccess.${escapedEmail}`]: data.role, // Use email as key for pendingAccess
  });
};

const handleRemoveOperation = async (
  transaction: FirebaseFirestore.Transaction,
  logDocRef: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>,
  data: z.infer<typeof updateShareRequest>,
  logData: JournalSchemaType,
) => {
  // Check if the email is in the access map (active contributor)
  const access = logData?.access ?? {};
  const contributorEntry = Object.entries(access).find(
    ([_, value]) => value.email === data.email,
  );

  if (contributorEntry) {
    const [uid, contributorData] = contributorEntry;

    // Prevent admin from removing themselves if they are the sole admin
    if (contributorData.role === 'admin') {
      const adminCount = Object.values(access).filter((c) => c.role === 'admin').length;
      if (adminCount <= 1) {
        throw new HttpsError('permission-denied', 'Cannot remove the sole admin.');
      }
    }

    // Remove the user from the access map
    transaction.update(logDocRef, {
      [`access.${uid}`]: FieldValue.delete(),
    });

    // Remove UID from access_array
    transaction.update(logDocRef, {
      access_array: FieldValue.arrayRemove(uid),
    });
    logger.info(`Removed ${data.email} (UID: ${uid}) from access and access_array.`);
    return;
  }

  // If the email is not in the access map, check pendingAccess map
  const pendingAccess = logData?.pendingAccess ?? {};
  const escapedEmail = data.email.replace(/\./g, ',');
  if (pendingAccess[escapedEmail]) {
    // Remove the email from the pendingAccess map
    transaction.update(logDocRef, {
      [`pendingAccess.${escapedEmail}`]: FieldValue.delete(),
    });
    logger.info(`Removed ${data.email} from pendingAccess.`);
  } else {
    logger.warn(
      `Attempted to remove ${data.email}, but they were not found in access or pendingAccess.`,
    );
  }
};
