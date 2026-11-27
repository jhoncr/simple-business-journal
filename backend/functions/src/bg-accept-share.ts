// backend/functions/src/bg-accept-share.ts

import { HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import * as z from 'zod';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';
import { JOURNAL_COLLECTION } from './common/const';
import { createAuditedCallable } from './helpers/audited-function';
import { JournalSchema } from './common/schemas/JournalSchema';
import { docIdSchema } from './common/schemas/common_schemas';
import { findPendingAccessKey, normalizeEmail } from './helpers/email-utils';

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

const schema = z
  .object({
    jid: docIdSchema,
    operation: z.enum(['accept', 'ignore', 'check']),
  })
  .strict();

/**
 * Validates that the caller has a verified email address before checking or accepting an invite.
 * Exported for unit tests.
 */
export function assertVerifiedEmailForShare(
  token: { email?: unknown; email_verified?: unknown } | undefined,
): string {
  if (token?.email_verified !== true || typeof token?.email !== 'string' || !token.email.trim()) {
    throw new HttpsError(
      'failed-precondition',
      'Your email address must be verified before accepting an invitation.',
    );
  }
  return normalizeEmail(token.email);
}

export const acceptShare = createAuditedCallable(
  'acceptShare',
  JOURNAL_COLLECTION,
  [],
  schema,
  async (request) => {
    try {
      logger.info('acceptShare called');

      const { jid: businessId, operation } = request.data;
      const uid = request.auth!.uid;
      const rawEmail = request.auth!.token?.email;
      const emailVerified = request.auth!.token?.email_verified === true;

      if (operation === 'ignore') {
        // Verify an actual pending invite exists for this caller before attributing
        // an audit event to the target journal, preventing arbitrary audit-log pollution.
        let hasPendingInvite = false;
        if (emailVerified && typeof rawEmail === 'string' && rawEmail.trim()) {
          const logDoc = await db.collection(JOURNAL_COLLECTION).doc(businessId).get();
          if (logDoc.exists) {
            const logData = logDoc.data() as z.infer<typeof JournalSchema>;
            if (
              logData.isActive !== false &&
              findPendingAccessKey(logData.pendingAccess, rawEmail)
            ) {
              hasPendingInvite = true;
            }
          }
        }
        logger.info(
          `User ${uid} ignored share for business ${businessId} (verified invite: ${hasPendingInvite})`,
        );
        return {
          id: hasPendingInvite ? businessId : undefined,
          response: { result: 'ok', message: 'Ignored grant to access log' },
        };
      }

      const normalizedEmail = assertVerifiedEmailForShare(request.auth!.token);

      // Transaction to check or accept the invitation on the business document
      const result = await db.runTransaction(async (transaction) => {
        const logDocRef = db.collection(JOURNAL_COLLECTION).doc(businessId);
        const logDoc = await transaction.get(logDocRef);

        if (!logDoc.exists) {
          throw new HttpsError(
            'not-found',
            'The business document does not exist or you do not have access.',
          );
        }

        const logData = logDoc.data() as z.infer<typeof JournalSchema>;

        if (logData.isActive === false) {
          throw new HttpsError(
            'permission-denied',
            'This business journal is no longer active.',
          );
        }

        // Check if user already has access
        if (
          logData.access &&
          Object.prototype.hasOwnProperty.call(logData.access, uid)
        ) {
          const existingRole = logData.access[uid].role;
          logger.info(
            `User ${uid} already has access to business ${businessId} with role ${existingRole}`,
          );
          return {
            id: businessId,
            response: {
              result: 'ok',
              alreadyHasAccess: true,
              role: existingRole,
              message: 'You already have access to this business.',
            },
          };
        }

        const matchedPendingKey = findPendingAccessKey(
          logData.pendingAccess,
          normalizedEmail,
        );

        // Check operation: Verify invitation exists
        if (operation === 'check') {
          if (matchedPendingKey && logData.pendingAccess) {
            const role = logData.pendingAccess[matchedPendingKey];
            logger.info(
              `Access check successful for ${normalizedEmail} on business ${businessId}. Role: ${role}`,
            );
            return {
              id: businessId,
              response: {
                result: 'ok',
                message: `You have a pending invitation as a ${role}.`,
              },
            };
          } else {
            logger.warn(
              `Access check failed for ${normalizedEmail} on business ${businessId}. No pending access found.`,
            );
            throw new HttpsError(
              'not-found',
              'You have not been invited to access this business or the invitation was revoked.',
            );
          }
        }

        // Core logic for "accept" operation
        if (matchedPendingKey && logData.pendingAccess) {
          logger.info(
            `Accepting share for ${normalizedEmail} on business ${businessId}.`,
          );
          const role = logData.pendingAccess[matchedPendingKey];

          const updates: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
            [`access.${uid}`]: {
              role,
              email: normalizedEmail,
              displayName: request?.auth?.token?.name || '',
              photoURL: request?.auth?.token?.picture || '',
            },
            [`pendingAccess.${matchedPendingKey}`]: FieldValue.delete(),
            access_array: FieldValue.arrayUnion(uid),
            updatedAt: FieldValue.serverTimestamp(),
          };

          transaction.update(logDocRef, updates);
          logger.info(
            `User ${uid} (${normalizedEmail}) successfully added to business ${businessId} with role ${role}.`,
          );
          return {
            id: businessId,
            response: {
              result: 'ok',
              message: 'Accepted grant to access business',
            },
          };
        } else {
          logger.warn(
            `Accept operation failed for ${normalizedEmail} on business ${businessId}. No pending access found.`,
          );
          throw new HttpsError(
            'permission-denied',
            'You have not been invited to access this business or the invitation may have been withdrawn.',
          );
        }
      });

      return result;
    } catch (error) {
      logger.error('Error accepting share for business:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        'internal',
        'Error accepting share. Please try again later.',
      );
    }
  },
);
