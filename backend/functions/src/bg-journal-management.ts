import { HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initializeApp, getApps } from "firebase-admin/app";
import { JOURNAL_COLLECTION, JOURNAL_TYPES } from "./common/const";
import {
  JournalSchema,
  businessDetailsSchema,
} from "./common/schemas/JournalSchema";
import * as z from "zod";
import { createAuditedCallable } from "./helpers/audited-function";

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();


const CreateJournalPayloadSchema = JournalSchema.omit({
  id: true,
  access: true,
  access_array: true,
  pendingAccess: true,
  createdAt: true,
  isActive: true,
}).extend({
  details: businessDetailsSchema,
}).refine(
  (data) => {
    return (
      data.journalType === JOURNAL_TYPES.BUSINESS &&
      businessDetailsSchema.safeParse(data.details).success
      // Add checks for other types as needed
    );
  },
  {
    message: "Details must match the specified journal type.",
    path: ["details"],
  },
);

// type CreateJournalPayloadType = z.infer<typeof CreateJournalPayloadSchema>;

export const createJournal = createAuditedCallable(
  "createJournal",
  JOURNAL_COLLECTION,
  [],
  CreateJournalPayloadSchema,
  async (request) => {
    const uid = request.auth!.uid;
    const access = {
      [uid]: {
        role: "admin",
        email: request.auth!.token.email || null,
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
    } catch (error: any) {
      logger.error("Journal creation failed", error);
      throw new HttpsError(
        "internal",
        `Journal creation failed: ${error.message || error}`,
      );
    }
  },
  { isCreateOperation: true },
);

const UpdateJournalPayloadSchema = CreateJournalPayloadSchema.extend({
    id: z.string().min(1),
    details: businessDetailsSchema.partial().optional(),
  }).partial();
// .refine(

// type UpdateJournalPayloadType = z.infer<typeof UpdateJournalPayloadSchema>;

export const updateJournal = createAuditedCallable(
  "updateJournal",
  JOURNAL_COLLECTION,
  ["admin"],
  UpdateJournalPayloadSchema,
  async (request) => {
    const { id: journalId, title, details } = request.data;

    try {
      const docRef = db.collection(JOURNAL_COLLECTION).doc(journalId);

      const updateData: Record<string, any> = {};
      if (title !== undefined) updateData.title = title;
      if (details !== undefined) updateData.details = details;

      if (Object.keys(updateData).length > 0) {
        updateData.updatedAt = FieldValue.serverTimestamp();
        await docRef.update(updateData);
        logger.info(`Journal ${journalId} updated successfully.`);
      } else {
        logger.info(`No changes detected for journal ${journalId}.`);
      }

      return { id: journalId, response: { success: true } };
    } catch (error: any) {
      logger.error("Update failed", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError(
        "internal",
        `Update failed: ${error.message || error}`,
      );
    }
  },
);
