// backend/functions/src/bg-add-log-entry.ts
import { HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

import { JOURNAL_COLLECTION } from './common/const';
import {
  ENTRY_CONFIG,
  entrySchema,
  EntryType,
} from './common/schemas/configmap';
import { handleSchemaValidationError } from './lib/bg-consts';
import { createAuditedCallable } from './helpers/audited-function';

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

const ALLOWED_THUMBNAIL_MIMES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/webp': 'webp',
};

const THUMBNAIL_DATA_URL_RE = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/;

/**
 * Validates and decodes a base64 template thumbnail data URL against the strict image MIME allowlist.
 * Exported for unit tests.
 */
export function parseThumbnailDataUrl(thumbnailBase64: string): {
  contentType: string;
  ext: string;
  buffer: Buffer;
} {
  const match = THUMBNAIL_DATA_URL_RE.exec(thumbnailBase64);
  if (!match) {
    throw new HttpsError(
      'invalid-argument',
      'Invalid thumbnail image format. Expected a base64-encoded PNG, JPEG, or WebP data URL.',
    );
  }
  const contentType = match[1].toLowerCase();
  const ext = ALLOWED_THUMBNAIL_MIMES[contentType];
  if (!ext) {
    throw new HttpsError(
      'invalid-argument',
      `Unsupported thumbnail MIME type: ${contentType}. Allowed types: image/png, image/jpeg, image/webp.`,
    );
  }
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0) {
    throw new HttpsError(
      'invalid-argument',
      'Thumbnail image payload is empty.',
    );
  }
  return { contentType, ext, buffer };
}

/**
 * Enforces server ownership of `details.payments` for estimates written via addLogFn:
 * creates always start with `payments: []`, and updates preserve the existing server array.
 * Exported for unit tests.
 */
export function preserveServerPayments(
  details: Record<string, unknown>,
  existingPayments?: unknown,
): Record<string, unknown> {
  return {
    ...details,
    payments: Array.isArray(existingPayments) ? existingPayments : [],
  };
}

/**
 * Verifies that a journal exists, is active, and grants the caller one of the required roles.
 */
function assertJournalWriteAccess(
  journalDoc: FirebaseFirestore.DocumentSnapshot,
  uid: string,
  allowedRoles: readonly string[],
): FirebaseFirestore.DocumentData {
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
  if (!userRole || !allowedRoles.includes(userRole)) {
    throw new HttpsError(
      'permission-denied',
      'No access to add entries to this journal.',
    );
  }
  return journalData;
}

/**
 * Verifies that an existing entry is active and satisfies the optimistic-concurrency guard.
 */
function assertEntryCanBeUpdated(
  existingEntryDoc: FirebaseFirestore.DocumentSnapshot,
  entryId: string,
  targetSubcollectionName: string,
  expectedUpdatedAtMillis?: number | null,
): FirebaseFirestore.DocumentData {
  if (!existingEntryDoc.exists) {
    throw new HttpsError(
      'not-found',
      `Entry ${entryId} not found in ${targetSubcollectionName}.`,
    );
  }
  const existingData = existingEntryDoc.data() ?? {};
  if (existingData.isActive === false) {
    throw new HttpsError(
      'failed-precondition',
      'Cannot update a deleted entry.',
    );
  }
  if (expectedUpdatedAtMillis != null) {
    const currentMillis = existingData.updatedAt?.toMillis?.();
    if (
      typeof currentMillis === 'number' &&
      currentMillis !== expectedUpdatedAtMillis
    ) {
      throw new HttpsError(
        'failed-precondition',
        'This entry was modified by someone else. Please reload and try again.',
      );
    }
  }
  return existingData;
}

export const addLogFn = createAuditedCallable(
  'addLogFn',
  JOURNAL_COLLECTION,
  [], // Custom transactional role check below
  entrySchema,
  async (request) => {
    try {
      logger.info('addLogFn called');
      const {
        jid: journalId,
        entryType,
        name,
        details: rawDetails,
        entryId,
        thumbnailBase64,
        expectedUpdatedAtMillis,
      } = request.data;

      const uid = request.auth!.uid;

      const config = ENTRY_CONFIG[entryType as EntryType];
      if (!config) {
        throw new HttpsError(
          'invalid-argument',
          `Unsupported entryType: ${entryType}`,
        );
      }
      const {
        subcollection: targetSubcollectionName,
        schema: detailsSchema,
        allowedRoles,
      } = config;

      const detailsResult = detailsSchema.safeParse(rawDetails);
      if (!detailsResult.success) {
        handleSchemaValidationError(entryType, detailsResult);
      }
      const validatedDetails: Record<string, unknown> = {
        ...(detailsResult.data as Record<string, unknown>),
      };

      logger.info(`Entry details for ${entryType} validated successfully.`);

      const journalDocRef = db.collection(JOURNAL_COLLECTION).doc(journalId);
      const entriesColRef = journalDocRef.collection(targetSubcollectionName);
      const actualEntryId = entryId || entriesColRef.doc().id;
      const entryDocRef = entriesColRef.doc(actualEntryId);

      // For template thumbnail uploads, validate MIME allowlist, journal permissions,
      // and (on updates) entry existence + active state + optimistic concurrency BEFORE
      // writing anything to Cloud Storage.
      if (thumbnailBase64 && entryType === 'template') {
        const { contentType, ext, buffer } = parseThumbnailDataUrl(thumbnailBase64);

        const precheckJournal = await journalDocRef.get();
        assertJournalWriteAccess(precheckJournal, uid, allowedRoles);

        if (entryId) {
          const precheckEntry = await entryDocRef.get();
          assertEntryCanBeUpdated(
            precheckEntry,
            actualEntryId,
            targetSubcollectionName,
            expectedUpdatedAtMillis,
          );
        }

        const filePath = `journals/${journalId}/templates/${actualEntryId}/thumbnail.${ext}`;
        try {
          const bucket = getStorage().bucket();
          const file = bucket.file(filePath);
          await file.save(buffer, {
            metadata: {
              contentType,
              cacheControl: 'public, max-age=31536000',
            },
          });
          validatedDetails.thumbnailUrl = `/${filePath}`;
          logger.info(
            `Thumbnail uploaded successfully for template ${actualEntryId}`,
          );
        } catch (uploadError) {
          logger.error('Error uploading thumbnail:', uploadError);
          throw new HttpsError(
            'internal',
            'Failed to upload template thumbnail. Please try again later.',
          );
        }
      }

      if (entryId) {
        await db.runTransaction(async (transaction) => {
          const journalDoc = await transaction.get(journalDocRef);
          assertJournalWriteAccess(journalDoc, uid, allowedRoles);

          const existingEntryDoc = await transaction.get(entryDocRef);
          const existingData = assertEntryCanBeUpdated(
            existingEntryDoc,
            actualEntryId,
            targetSubcollectionName,
            expectedUpdatedAtMillis,
          );

          const detailsToSave =
            entryType === 'estimate' ?
              preserveServerPayments(
                validatedDetails,
                (existingData.details as Record<string, unknown> | undefined)?.payments,
              ) :
              validatedDetails;

          transaction.update(entryDocRef, {
            name,
            details: detailsToSave,
            updatedAt: FieldValue.serverTimestamp(),
            // DO NOT overwrite isActive, createdBy, or createdAt on edits
          });
        });

        logger.info(
          `Entry ${actualEntryId} in ${targetSubcollectionName} updated successfully`,
        );
        const snap = await entryDocRef.get();
        return {
          id: journalId,
          response: {
            result: 'ok',
            message: 'Entry updated successfully',
            id: actualEntryId,
            updatedAtMillis: snap.data()?.updatedAt?.toMillis?.() ?? null,
          },
        };
      } else {
        await db.runTransaction(async (transaction) => {
          const journalDoc = await transaction.get(journalDocRef);
          assertJournalWriteAccess(journalDoc, uid, allowedRoles);

          const detailsToSave =
            entryType === 'estimate' ?
              preserveServerPayments(validatedDetails) :
              validatedDetails;

          transaction.set(entryDocRef, {
            name,
            isActive: true,
            createdBy: uid,
            details: detailsToSave,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        });

        logger.info(
          `${entryType} entry successfully added to ${targetSubcollectionName} in journal ${journalId}`,
        );
        const snap = await entryDocRef.get();
        return {
          id: journalId,
          response: {
            result: 'ok',
            message: 'Entry added successfully',
            id: entryDocRef.id,
            updatedAtMillis: snap.data()?.updatedAt?.toMillis?.() ?? null,
          },
        };
      }
    } catch (error) {
      logger.error('Error in addLogFn: ', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        'internal',
        'An unexpected error occurred. Please try again later.',
      );
    }
  },
);
