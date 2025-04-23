// backend/functions/src/bg-accept-share.ts

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as z from "zod";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initializeApp, getApps } from "firebase-admin/app";
// --- Update import ---
import { JOURNAL_COLLECTION } from "./common/const";
import { ALLOWED } from "./lib/bg-consts";
import { JournalSchemaType } from "./common/schemas/JournalSchema"; // Keep for typing

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

// --- Schema remains the same ---
const schema = z
  .object({
    journalID: z.string(),
    operation: z.enum(["accept", "ignore", "check"]),
  })
  .strict();

export const acceptShare = onCall(
  {
    cors: ALLOWED,
    enforceAppCheck: true, // Keep App Check enforcement
  },
  async (request) => {
    try {
      logger.info("acceptShare called");
      if (!request.auth || !request.auth.uid || !request.auth.token?.email) {
        throw new HttpsError(
          "unauthenticated",
          "You must be signed in to manage sharing.",
        );
      }

      const result = schema.safeParse(request.data);
      if (!result.success) {
        throw new HttpsError(
          "invalid-argument",
          result.error.issues.map((issue) => issue.message).join("\n"),
        );
      }

      const { journalID: journalId, operation } = result.data; // Use journalId for consistency with original code
      const uid = request.auth.uid;
      const email = request.auth.token?.email;

      if (operation === "ignore") {
        // Optionally: You could add logic here to record the ignore action if needed
        logger.info(
          `User ${uid} (${email}) ignored share for journal ${journalId}`,
        );
        return { result: "ok", message: "Ignored grant to access log" };
      }

      // Transaction to modify the journal document
      await db.runTransaction(async (transaction) => {
        const logDocRef = db.collection(JOURNAL_COLLECTION).doc(journalId);
        const logDoc = await transaction.get(logDocRef);

        if (!logDoc.exists) {
          throw new HttpsError(
            "not-found",
            "The journal document does not exist or you do not have access.", // Simplified message
          );
        }

        // Type assertion for convenience, ensure JournalSchemaType is imported
        const logData = logDoc.data() as JournalSchemaType;

        // Check if user already has access
        if (logData.access && logData.access[uid]) {
          logger.info(`User ${uid} already has access to journal ${journalId}`);
          // No error needed, just inform the user
          return; // Exit transaction successfully
        }

        // Check operation: Verify invitation exists
        if (operation === "check") {
          if (email && logData.pendingAccess && logData.pendingAccess[email]) {
            logger.info(
              `Access check successful for ${email} on journal ${journalId}`,
            );
            return; // Exit transaction successfully
          } else {
            logger.warn(
              `Access check failed for ${email} on journal ${journalId}. No pending access found.`,
            );
            throw new HttpsError(
              "not-found", // Or 'permission-denied'
              "You have not been invited to access this journal or the invitation was revoked.",
            );
          }
        }

        // Accept operation
        if (operation !== "accept") {
          // Should not happen if schema validation is correct, but good safety check
          throw new HttpsError(
            "invalid-argument",
            `Invalid operation: ${operation}`,
          );
        }

        // --- Core Logic: Move from pendingAccess to access ---
        if (
          email &&
          logData.pendingAccess && // Ensure pendingAccess exists
          Object.prototype.hasOwnProperty.call(logData.pendingAccess, email) // Safer check
        ) {
          logger.info(`Accepting share for ${email} on journal ${journalId}.`);
          const role = logData.pendingAccess[email]; // Get the role from pending

          // Prepare updates
          const updates: Record<string, any> = {
            // Add to access map
            [`access.${uid}`]: {
              role: role,
              email: email,
              displayName: request?.auth?.token?.name || "",
              photoURL: request?.auth?.token?.picture || "",
            },
            // Remove from pendingAccess map, only if email is not null
            [`pendingAccess.${email}`]: FieldValue.delete(),
            // Add UID to access_array
            access_array: FieldValue.arrayUnion(uid),
            updatedAt: FieldValue.serverTimestamp(), // Update timestamp
          };

          // --- REMOVED Parent Update Logic ---
          // No parent document to update in the new model.

          transaction.update(logDocRef, updates);
          logger.info(
            `User ${uid} (${email}) successfully added to journal ${journalId} with role ${role}.`,
          );
        } else {
          logger.warn(
            `Accept operation failed for ${email} on journal ${journalId}. No pending access found.`,
          );
          throw new HttpsError(
            "permission-denied",
            "You have not been invited to access this journal or the invitation may have been withdrawn.",
          );
        }
      }); // End transaction

      // If transaction completes without throwing, it was successful.
      if (operation === "check") {
        return { result: "ok", message: "You have a pending invitation." };
      }
      return { result: "ok", message: "Accepted grant to access journal" };
    } catch (error) {
      logger.error("Error accepting share for journal:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        "internal",
        "Error accepting share. Please try again later.",
      );
    }
  },
);
