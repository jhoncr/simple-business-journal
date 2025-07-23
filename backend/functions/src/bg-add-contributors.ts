import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import * as z from 'zod';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';
import { JOURNAL_COLLECTION } from './common/const';
import { JournalSchemaType } from './common/schemas/JournalSchema';
import { ALLOWED } from './lib/bg-consts';
import { ROLES } from './common/schemas/common_schemas';

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

const SHARE_ROLES = new Set(['admin']);

const updateShareRequest = z
  .object({
    email: z.string().email(),
    role: z.enum(ROLES),
    operation: z.enum(['add', 'remove']),
    journalId: z.string(),
  })
  .strict();

interface Contributor {
  role: string;
  email: string;
  displayName: string;
  photoURL: string;
  uid?: string;
}

// allow cors for all origins
export const addContributor = onCall(
  {
    cors: ALLOWED,
    enforceAppCheck: true,
  },
  async (request) => {
    try {
      logger.info('addContributor called');
      // return error if not authenticated
      if (!request.auth) {
        throw new HttpsError(
          'unauthenticated',
          'You must be signed in to add a message',
        );
      }

      // check if the request.data is valid
      const result = updateShareRequest.safeParse(request.data);
      if (!result.success) {
        throw new HttpsError(
          'invalid-argument',
          result.error.message, // Simplified error message
        );
      }

      // get the journalId from the request
      const journalId = result.data.journalId;
      const uid = request.auth.uid;

      // transaction to add the people to logDoc.access map
      await db.runTransaction(async (transaction) => {
        // get the log document
        const logDocRef = db.collection(JOURNAL_COLLECTION).doc(journalId);
        const logDoc = await transaction.get(logDocRef);

        // check if the log document exists
        if (!logDoc.exists) {
          throw new HttpsError(
            'not-found',
            'The log document does not exist or you do not have access to it.',
          );
        }

        // check if the user is allowed to share a log entry
        const logData = logDoc.data();

        const hasAccess: { [uid: string]: Contributor } = logData?.access ?? {};
        if (!(uid in hasAccess) || !SHARE_ROLES.has(hasAccess[uid].role)) {
          throw new HttpsError(
            'permission-denied',
            'You do not have permission to add or remove contributors to this log entry.',
          );
        }

        logger.info('User is allowed to share this journal');
        logger.debug('logData', logData);
        logger.debug('result.data.', result.data);

        if (result.data.operation === 'add') {
          handleAddOperation(
            transaction,
            logDocRef,
            result.data,
            logData as JournalSchemaType,
          );
        } else if (result.data.operation === 'remove') {
          handleRemoveOperation(
            transaction,
            logDocRef,
            result.data,
            logData as JournalSchemaType,
          );
        }
      });
      // return success
    } catch (error) {
      logger.log('Error adding contributors', error);
      // check if errors is a https error
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        'internal',
        'Error adding contributors. Please try again later.',
      );
    }

    // return ok
    return { result: 'ok', message: 'operation completed successfully' };
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

  // If the email is not in the access map, add it to pendingAccess map
  const pendingAccess = logData?.pendingAccess ?? {};
  // Avoid overwriting if email already in pendingAccess, update role instead
  if (pendingAccess[data.email] && pendingAccess[data.email] !== data.role) {
     logger.info(`Updating role for ${data.email} in pendingAccess to ${data.role}.`);
  } else if (!pendingAccess[data.email]) {
    logger.info(`Adding ${data.email} to pendingAccess with role ${data.role}.`);
  }
  transaction.update(logDocRef, {
    [`pendingAccess.${data.email}`]: data.role, // Use email as key for pendingAccess
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
  if (pendingAccess[data.email]) {
    // Remove the email from the pendingAccess map
    transaction.update(logDocRef, {
      [`pendingAccess.${data.email}`]: FieldValue.delete(),
    });
    logger.info(`Removed ${data.email} from pendingAccess.`);
  } else {
    logger.warn(
      `Attempted to remove ${data.email}, but they were not found in access or pendingAccess.`,
    );
  }
};
