// backend/functions/src/bg-accept-share.ts

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as z from "zod";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initializeApp, getApps } from "firebase-admin/app";
import { JOURNAL_COLLECTION } from "./common/const";
import { ALLOWED } from "./lib/bg-consts";
import { JournalSchemaType } from "./common/schemas/JournalSchema";

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

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
          result.error.message, // Simplified error message
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
          return null; // Exit transaction successfully
        }

        // Check operation: Verify invitation exists
        if (operation === "check") {
          if (email && logData.pendingAccess && logData.pendingAccess[email]) {
            const role = logData.pendingAccess[email];
            logger.info(
              `Access check successful for ${email} on journal ${journalId}. Role: ${role}`,
            );
            // Message now includes the role.
            // This return is inside the transaction, so the main return after transaction won't be hit for "check".
            return {
              result: "ok",
              message: `You have a pending invitation as a ${role}.`,
            };
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

        // --- Core Logic for "accept" operation ---
        // The `if (operation !== "accept")` check is removed as it's redundant here.
        // If operation was "ignore" or "check", logic would have returned/thrown before this point.

        if (
          email &&
          logData.pendingAccess &&
          Object.prototype.hasOwnProperty.call(logData.pendingAccess, email)
        ) {
          logger.info(`Accepting share for ${email} on journal ${journalId}.`);
          const role = logData.pendingAccess[email];

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
          return null;
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

      // If the transaction returned a specific message (e.g. for "check"), that will be the function's return.
      // Otherwise, default to "accept" operation's success message.
      // Note: The transaction now returns the message for "check", so this part is mainly for "accept".
      // If the transaction promise resolves to an object (like the one from "check"),
      // that object will be returned by the onCall function.
      // If the transaction promise resolves to undefined (normal successful transaction for "accept"),
      // then the specific message for "accept" is returned.
      return { result: "ok", message: "Accepted grant to access journal" };
    } catch (error) {
      // If HttpsError was thrown from within the transaction for "check" (e.g. "not-found"),
      // it will be caught here and re-thrown.
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
