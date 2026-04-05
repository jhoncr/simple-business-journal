// backend/functions/src/bg-add-log-entry.ts
import { HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { v4 as uuidv4 } from 'uuid';
import * as z from 'zod';
import { JOURNAL_COLLECTION } from './common/const';
import {
  ENTRY_CONFIG,
  entrySchema,
  EntryType,
} from './common/schemas/configmap';
import { handleSchemaValidationError } from './lib/bg-consts';
import { EntryItf } from './common/common_types';
import { createAuditedCallable } from './helpers/audited-function';

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

export const addLogFn = createAuditedCallable(
  'addLogFn',
  JOURNAL_COLLECTION,
  [], // Custom role check below
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
      } = request.data as z.infer<typeof entrySchema>;

      const uid = request.auth!.uid;

      // Get the main journal document to check access and journalType
      const journalDocRef = db.collection(JOURNAL_COLLECTION).doc(journalId);
      const journalDoc = await journalDocRef.get();
      if (!journalDoc.exists) {
        throw new HttpsError('not-found', 'Journal not found or no access.');
      }
      const journalData = journalDoc.data() || {};
      const journalType = journalData.journalType;

      const config = ENTRY_CONFIG[entryType as EntryType];
      if (!config) {
        throw new HttpsError(
          'invalid-argument',
          `Unsupported entryType: ${entryType}`,
        );
      }
      const { subcollection: targetSubcollectionName, schema: detailsSchema, allowedRoles } =
        config;

      if (
        !Object.getOwnPropertyDescriptor(journalData?.access ?? {}, uid) ||
        !allowedRoles.includes(journalData?.access?.[uid]?.role)
      ) {
        throw new HttpsError(
          'permission-denied',
          'No access to add entries to this journal.',
        );
      }

      logger.info(
        `Processing entryType '${entryType}' for journal ${journalId} (type: ${journalType}).` +
          ` Target subcollection: ${targetSubcollectionName}`,
      );
      const detailsResult = detailsSchema.safeParse(rawDetails);
      if (!detailsResult.success) {
        // Use the utility function for schema errors
        handleSchemaValidationError(entryType, detailsResult);
      }
      const validatedDetails = detailsResult.data;

      logger.info(`Entry details for ${entryType} validated successfully.`);

      const entriesColRef = journalDocRef.collection(targetSubcollectionName);
      const actualEntryId = entryId || entriesColRef.doc().id;

      if (thumbnailBase64 && entryType === 'template') {
        try {
          const bucket = getStorage().bucket();
          const filePath = `journals/${journalId}/templates/${actualEntryId}/thumbnail.png`;
          const file = bucket.file(filePath);

          // Remove the data:image/png;base64, part if present
          const base64Data = thumbnailBase64.replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');

          const token = uuidv4();

          await file.save(buffer, {
            metadata: {
              contentType: 'image/png',
              metadata: {
                firebaseStorageDownloadTokens: token,
              },
            },
          });

          const encodedFilePath = encodeURIComponent(filePath);
          const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedFilePath}?alt=media&token=${token}`;

          (validatedDetails as any).thumbnailUrl = downloadUrl;
          logger.info(`Thumbnail uploaded successfully for template ${actualEntryId}`);
        } catch (uploadError) {
          logger.error('Error uploading thumbnail:', uploadError);
          // We don't fail the entire request if thumbnail upload fails
        }
      }

      // Construct the base entry object (timestamps and details added below)
      const baseEntry: Omit<
        EntryItf,
        'createdAt' | 'updatedAt' | 'details' | 'createdBy'
      > = {
        name: name,
        isActive: true,
        // createdBy will be set based on context (add vs update)
      };

      if (entryId) {
        const res = await _updateEntry(
          db,
          entriesColRef,
          actualEntryId,
          baseEntry,
          validatedDetails,
          targetSubcollectionName,
        );
        return { id: journalId, response: res };
      } else {
        const docRef = entriesColRef.doc(actualEntryId);
        const res = await _addEntry(
          docRef,
          baseEntry,
          validatedDetails,
          uid,
          entryType,
          journalId,
          targetSubcollectionName,
        );
        return { id: journalId, response: res };
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

// --- Helper function to add a new entry ---
/**
 * Adds a new entry to the specified journal.
 * @param docRef - The Firestore document reference for the new entry.
 * @param baseEntry - The base entry data (excluding timestamps and details).
 * @param validatedDetails - The validated details for the entry.
 * @param uid - The user ID of the entry creator.
 * @param entryType - The type of the entry (for logging purposes).
 * @param journalId - The ID of the journal (for logging purposes).
 * @param targetSubcollectionName - The name of the subcollection where the entry will be added.
 * @returns A promise that resolves with the result of the add operation.
 */
async function _addEntry(
  docRef: FirebaseFirestore.DocumentReference,
  baseEntry: Omit<
    EntryItf,
    'createdAt' | 'updatedAt' | 'details' | 'createdBy'
  >,
  validatedDetails: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  uid: string,
  entryType: string, // For logging
  journalId: string, // For logging
  targetSubcollectionName: string, // For logging
) {
  try {
    await docRef.set({
      ...baseEntry,
      createdBy: uid, // Set creator on add
      details: validatedDetails,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    logger.info(
      `${entryType} entry successfully added to ${targetSubcollectionName} in journal ${journalId}`,
    );
    return {
      result: 'ok',
      message: 'Entry added successfully',
      id: docRef.id,
    };
  } catch (error) {
    logger.error('Error adding entry: ', error);
    throw new HttpsError(
      'internal',
      'Failed to add entry. Please try again later.',
    );
  }
}

// --- Helper function to update an existing entry ---
/**
 * Updates an existing entry in the specified journal.
 * @param db - The Firestore database instance.
 * @param entriesColRef - The Firestore collection reference for the journal's entries.
 * @param entryId - The ID of the entry to update.
 * @param baseEntry - The base entry data (excluding timestamps and details).
 * @param validatedDetails - The validated details for the entry.
 * @param targetSubcollectionName - The name of the subcollection where the entry is located.
 * @returns A promise that resolves with the result of the update operation.
 */
async function _updateEntry(
  db: FirebaseFirestore.Firestore,
  entriesColRef: FirebaseFirestore.CollectionReference,
  entryId: string,
  baseEntry: Omit<
    EntryItf,
    'createdAt' | 'updatedAt' | 'details' | 'createdBy'
  >,
  validatedDetails: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  targetSubcollectionName: string, // For logging
) {
  try {
    await db.runTransaction(async (transaction) => {
      const entryDocRef = entriesColRef.doc(entryId);
      const existingEntryDoc = await transaction.get(entryDocRef);
      if (!existingEntryDoc.exists) {
        throw new HttpsError(
          'not-found',
          `Entry ${entryId} not found in ${targetSubcollectionName}.`,
        );
      }
      // Consider adding check if user is allowed to edit (e.g., createdBy === uid or role allows)

      transaction.update(entryDocRef, {
        ...baseEntry, // Include name, isActive
        details: validatedDetails,
        updatedAt: FieldValue.serverTimestamp(),
        // DO NOT update createdBy or createdAt on edits
      });
    });
    logger.info(
      `Entry ${entryId} in ${targetSubcollectionName} updated successfully`,
    );
    return {
      result: 'ok',
      message: 'Entry updated successfully',
      id: entryId,
    };
  } catch (error) {
    logger.error('Transaction failed during update: ', error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError(
      'internal',
      'Failed to update entry. Please try again later.',
    );
  }
}
