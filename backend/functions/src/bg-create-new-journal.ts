/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initializeApp, getApps } from "firebase-admin/app";
import { ALLOWED } from "./lib/bg-consts";
import { JournalSchema } from "./common/schemas/JournalSchema";
import { JOURNAL_COLLECTION } from "./common/const";

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

// allow cors for all origins
export const createNewJournal = onCall(
  {
    cors: ALLOWED,
    enforceAppCheck: true,
  },
  async (request) => {
    try {
      logger.info("createNewJournal called");
      // retunn erro if not authenticated
      if (!request.auth) {
        throw new HttpsError(
          "unauthenticated",
          "You must be signed in to create a message",
        );
      }

      // check if the request.data is valid
      const result = JournalSchema.safeParse(request.data);
      if (!result.success) {
        // return error to the client
        logger.error("Invalid request data", result.error);
        throw new HttpsError("invalid-argument", result.error.message);
      }

      const uid = request.auth.uid;

      const journalData = {
        title: result.data.title,
        journalType: result.data.journalType,
        access: {
          [uid]: {
            role: "admin",
            email: request.auth.token.email || null,
            displayName: request.auth.token.name || null,
            photoURL: request.auth.token.picture || null,
          },
        },
        access_array: [uid],
        createdAt: FieldValue.serverTimestamp(),
        isActive: true,
        details: {
          parent: null,
          currency:
            result.data.details && "currency" in result.data.details ?
              result.data.details.currency :
              null,
        },
      };
      //
      // Validate against JournalDocumentSchema
      const validationResult = JournalSchema.safeParse(journalData);
      if (!validationResult.success) {
        logger.error("Journal data validation error", validationResult.error);
        throw new HttpsError(
          "invalid-argument",
          "Invalid journal data. Please check the data you are sending." +
            validationResult.error.message, // Optionally add more details from validationResult.error
        );
      }
      // Use validated journalData to create a new document
      const logDocRef = db.collection(JOURNAL_COLLECTION).doc();
      await logDocRef.set(validationResult.data);
      return {
        result: "ok",
        message: `Log journal created successfully. uuid: ${logDocRef.id}`,
      };
    } catch (error) {
      logger.error("Error creating new journal", error);
      throw new HttpsError(
        "internal",
        "Error creating new journal. Please try again later.",
      );
    }

    // return ok
  },
);
