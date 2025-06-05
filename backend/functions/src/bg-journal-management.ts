import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initializeApp, getApps } from "firebase-admin/app";
import { JOURNAL_COLLECTION, JOURNAL_TYPES } from "./common/const";
import {
  JournalCreateBaseSchema,
  businessDetailsSchema,
} from "./common/schemas/JournalSchema";
import { ALLOWED } from "./lib/bg-consts";
import * as z from "zod";

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

const CreateJournalPayloadSchema = JournalCreateBaseSchema.extend({
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

export const createJournal = onCall(
  {
    cors: ALLOWED,
    enforceAppCheck: true,
  },
  async (request) => {
    logger.info("createJournal called");

    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "You must be signed in to perform this operation.",
      );
    }

    const result = CreateJournalPayloadSchema.safeParse(request.data);
    if (!result.success) {
      logger.error("Invalid request data", result.error.format());
      throw new HttpsError("invalid-argument", result.error.message);
    }

    const uid = request.auth.uid;
    const access = {
      [uid]: {
        role: "admin",
        email: request.auth.token.email || null,
        displayName: request.auth.token.name || null,
        photoURL: request.auth.token.picture || null,
      },
    };

    const { title, journalType, details } = result.data;

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
      return { journalId: journalDocRef.id };
    } catch (error: any) {
      logger.error("Journal creation failed", error);
      throw new HttpsError(
        "internal",
        `Journal creation failed: ${error.message || error}`,
      );
    }
  },
);

const UpdateJournalPayloadSchema = JournalCreateBaseSchema.partial()
  .extend({
    id: z.string().min(1),
    details: businessDetailsSchema.partial().optional(),
  })
  .refine(
    (data) => {
      const details = data.details;
      if (details) {
        if (
          data.journalType === JOURNAL_TYPES.BUSINESS &&
          !businessDetailsSchema.partial().safeParse(details).success
        ) {
          return false;
        }
      }
      return true;
    },
    {
      message: "Details must match the specified journal type.",
      path: ["details"],
    },
  );

// type UpdateJournalPayloadType = z.infer<typeof UpdateJournalPayloadSchema>;

export const updateJournal = onCall(
  {
    cors: ALLOWED,
    enforceAppCheck: true,
  },
  async (request) => {
    logger.info("updateJournal called");

    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "You must be signed in to perform this operation.",
      );
    }

    const result = UpdateJournalPayloadSchema.safeParse(request.data);
    if (!result.success) {
      logger.error("Invalid request data for update", result.error.format());
      throw new HttpsError(
        "invalid-argument",
        "Invalid journal data for update.",
      );
    }

    const uid = request.auth.uid;
    const { id: journalId, title, details } = result.data;

    try {
      const docRef = db.collection(JOURNAL_COLLECTION).doc(journalId);
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new HttpsError("not-found", "Journal not found");
      }

      const currentData = doc.data();
      if (!currentData) {
        throw new HttpsError("internal", "Journal data is missing.");
      }

      if (currentData.access?.[uid]?.role !== "admin") {
        throw new HttpsError("permission-denied", "Insufficient permissions");
      }

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

      return { success: true };
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
