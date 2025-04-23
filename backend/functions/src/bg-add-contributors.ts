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
import * as z from "zod";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initializeApp, getApps } from "firebase-admin/app";
import { JOURNAL_COLLECTION } from "./common/const";
import { JournalSchemaType } from "./common/schemas/JournalSchema";
import { ALLOWED } from "./lib/bg-consts";

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

const ROLES = ["viewer", "reporter", "editor", "admin"] as const;
const SHARE_ROLES = new Set(["admin"]);

const updateShareRequest = z
  .object({
    email: z.string().email(),
    role: z.enum(ROLES),
    operation: z.enum(["add", "remove"]),
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
      logger.info("addContributor called");
      // return error if not authenticated
      if (!request.auth) {
        throw new HttpsError(
          "unauthenticated",
          "You must be signed in to add a message",
        );
      }

      // check if the request.data is valid
      const result = updateShareRequest.safeParse(request.data);
      if (!result.success) {
        throw new HttpsError(
          "invalid-argument",
          result.error.issues.map((issue) => issue.message).join("\n"),
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
            "not-found",
            "The log document does not exist or you do not have access to it.",
          );
        }

        // check if the user is allowed to share a log entry
        const logData = logDoc.data();

        const hasAccess: { [uid: string]: Contributor } = logData?.access ?? {};
        if (!(uid in hasAccess) || !SHARE_ROLES.has(hasAccess[uid].role)) {
          throw new HttpsError(
            "permission-denied",
            "You do not have permission to add or remove contributors to this log entry.",
          );
        }

        logger.info("User is allowed to share this journal");
        logger.debug("logData", logData);
        logger.debug("result.data.", result.data);

        if (result.data.operation === "add") {
          handleAddOperation(
            transaction,
            logDocRef,
            result.data,
            logData as JournalSchemaType,
          );
        } else if (result.data.operation === "remove") {
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
      logger.log("Error adding contributors", error);
      // check if errors is a https error
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        "internal",
        "Error adding contributors. Please try again later.",
      );
    }

    // return ok
    return { result: "ok", message: "operation completed successfully" };
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
    const [key, _] = cur;
    // update the role
    // TODO: block update of admin role
    transaction.update(logDocRef, {
      [`access.${key}.role`]: data.role,
    });

    return;
  }
  // if the email is not in the access map, add it to pendingAccess map
  const pendingAccess = logData?.pendingAccess ?? {};
  transaction.update(logDocRef, {
    pendingAccess: {
      ...pendingAccess,
      [data.email]: data.role,
    },
  });
  return;
};

const handleRemoveOperation = async (
  transaction: FirebaseFirestore.Transaction,
  logDocRef: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>,
  data: z.infer<typeof updateShareRequest>,
  logData: JournalSchemaType,
) => {
  // check if the email is in the access map, if so, remove it from the access map
  const access = logData?.access ?? {};
  const cur = Object.entries(access).find(([key, value]) => {
    return value.email === data.email;
  });
  if (cur) {
    const [key, _] = cur;
    // remove the email from the access map
    transaction.update(logDocRef, {
      [`access.${key}`]: FieldValue.delete(),
    });

    // remove email from access_array, use FieldValue.arrayRemove
    transaction.update(logDocRef, {
      access_array: FieldValue.arrayRemove(data.email),
    });
    return;
  }
  // if the email is not in the access map, remove it from pendingAccess map
  const pendingAccess = logData?.pendingAccess ?? {};
  const cur2 = Object.entries(pendingAccess).find(([key, value]) => {
    return value === data.email;
  });
  // if the email is in the pendingAccess map, remove it from the pendingAccess map
  if (cur2) {
    const [key, _] = cur2;
    // remove the email from the pendingAccess map
    transaction.update(logDocRef, {
      [`pendingAccess.${key}`]: FieldValue.delete(),
    });
  }
  return;
};
