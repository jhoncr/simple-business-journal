// backend/functions/src/bg-add-log-entry.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initializeApp, getApps } from "firebase-admin/app";
import {
  JOURNAL_COLLECTION,
  ROLES_THAT_ADD, // --- Import ENTRY_CONFIG ---
} from "./common/const";
import { ENTRY_CONFIG,
  entrySchema, // --- Use updated entrySchema ---
  EntryType,
} from "./common/schemas/configmap";
import { ALLOWED, handleSchemaValidationError } from "./lib/bg-consts";
import { EntryItf } from "./common/common_types";

// import * as z from "zod"; // Import z

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

export const addLogFn = onCall(
  {
    cors: ALLOWED,
    enforceAppCheck: true,
  },
  async (request) => {
    try {
      logger.info("addLogFn called");
      if (!request.auth) {
        throw new HttpsError(
          "unauthenticated",
          "You must be signed in to add an entry",
        );
      }

      // --- Validate the request data against the base entry schema (includes entryType) ---
      const requestResult = entrySchema.safeParse(request.data);
      if (!requestResult.success) {
        // Use format() for better error logging
        logger.error(
          "Invalid request data format:",
          requestResult.error.format(),
        );
        throw new HttpsError(
          "invalid-argument",
          `Invalid request data: ${requestResult.error
            .format()
            ._errors?.join(", ")}`,
        );
      }

      // --- Destructure validated data, including entryType ---
      const {
        journalId,
        entryType, // --- Get entryType ---
        name,
        details: rawDetails,
        entryId,
      } = requestResult.data;
      const uid = request.auth.uid;

      // Get the main journal document to check access and journalType
      const journalDocRef = db.collection(JOURNAL_COLLECTION).doc(journalId);
      const journalDoc = await journalDocRef.get();
      if (!journalDoc.exists) {
        throw new HttpsError("not-found", "Journal not found or no access.");
      }
      const journalData = journalDoc.data() || {};
      const journalType = journalData.journalType; // Type of the parent journal (e.g., 'business', 'baby')

      // --- Check user permission ---
      if (
        !Object.getOwnPropertyDescriptor(journalData?.access ?? {}, uid) ||
        !ROLES_THAT_ADD.has(journalData?.access?.[uid]?.role)
      ) {
        throw new HttpsError(
          "permission-denied",
          "No access to add entries to this journal.",
        );
      }

      // --- Get subcollection configuration based on entryType ---
      const config = ENTRY_CONFIG[entryType as EntryType]; // Type assertion needed here
      if (!config) {
        throw new HttpsError(
          "invalid-argument",
          `Unsupported entryType: ${entryType}`,
        );
      }
      const { subcollection: targetSubcollectionName, schema: detailsSchema } =
        config;

      logger.info(
        `Processing entryType '${entryType}' for journal ${journalId} (type: ${journalType}).` +
          ` Target subcollection: ${targetSubcollectionName}`,
      );
      // --- Validate details against the specific schema for the entryType ---
      const detailsResult = detailsSchema.safeParse(rawDetails);
      if (!detailsResult.success) {
        // Use the utility function for schema errors
        handleSchemaValidationError(entryType, detailsResult);
      }
      const validatedDetails = detailsResult.data;

      logger.info(`Entry details for ${entryType} validated successfully.`);

      // Construct the base entry object (timestamps and details added below)
      const baseEntry: Omit<
        EntryItf,
        "createdAt" | "updatedAt" | "details" | "createdBy"
      > = {
        name: name,
        isActive: true,
        // createdBy will be set based on context (add vs update)
      };

      // --- Determine the target collection reference ---
      const entriesColRef = journalDocRef.collection(targetSubcollectionName);

      if (entryId) {
        // --- Update existing entry ---
        await db
          .runTransaction(async (transaction) => {
            const entryDocRef = entriesColRef.doc(entryId);
            // Optionally, verify the entry exists and belongs to the user if needed
            const existingEntryDoc = await transaction.get(entryDocRef);
            if (!existingEntryDoc.exists) {
              throw new HttpsError(
                "not-found",
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
          })
          .catch((error) => {
            logger.error("Transaction failed during update: ", error);
            if (error instanceof HttpsError) throw error;
            throw new HttpsError(
              "internal",
              "Failed to update entry. Please try again later.",
            );
          });
        logger.info(
          `Entry ${entryId} in ${targetSubcollectionName} updated successfully`,
        );
        return {
          result: "ok",
          message: "Entry updated successfully",
          id: entryId,
        };
      } else {
        // --- Add new entry ---
        const docRef = await entriesColRef
          .add({
            ...baseEntry,
            createdBy: uid, // Set creator on add
            details: validatedDetails,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          })
          .catch((error) => {
            logger.error("Error adding entry: ", error);
            throw new HttpsError(
              "internal",
              "Failed to add entry. Please try again later.",
            );
          });

        logger.info(
          `${entryType} entry successfully added to ${targetSubcollectionName} in journal ${journalId}`,
        );
        return {
          result: "ok",
          message: "Entry added successfully",
          id: docRef.id,
        };
      }
    } catch (error) {
      logger.error("Error in addLogFn:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        "internal",
        "An unexpected error occurred. Please try again later.",
      );
    }
  },
);
