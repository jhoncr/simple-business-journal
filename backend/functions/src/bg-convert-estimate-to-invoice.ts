// backend/functions/src/bg-convert-estimate-to-invoice.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initializeApp, getApps } from "firebase-admin/app";
import { JOURNAL_COLLECTION, ROLES_THAT_ADD } from "./common/const"; // Assuming ROLES_THAT_ADD is appropriate, or define new role check
import { ENTRY_CONFIG } from "./common/schemas/configmap";
import { ALLOWED } from "./lib/bg-consts"; // For CORS
import {
  estimateDetailsState,
  estimateDetailsStateSchema,
} from "./common/schemas/estimate_schema"; // For type hint and calculation
// Removed: import { invoiceDetailsSchema } from "./common/schemas/invoice_schema";

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

// Basic invoice number generation
function generateInvoiceNumber(prefix = "INV"): string {
  const now = new Date();
  const year = now.getFullYear();
  // Use a simpler timestamp chunk for uniqueness, or consider a Firestore counter for sequential numbers per journal.
  const uniquePart = String(Date.now()).slice(-6);
  return `${prefix}-${year}-${uniquePart}`;
}

export const convertEstimateToInvoiceFn = onCall(
  {
    cors: ALLOWED,
    enforceAppCheck: true, // Recommended for security
  },
  async (request) => {
    logger.info("convertEstimateToInvoiceFn called with data:", request.data);

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated.");
    }

    const { journalId, estimateId } = request.data;

    if (!journalId || !estimateId) {
      throw new HttpsError(
        "invalid-argument",
        "journalId and estimateId are required.",
      );
    }

    const uid = request.auth.uid;
    const estimateConfig = ENTRY_CONFIG.estimate;
    const estimateRef = db
      .collection(JOURNAL_COLLECTION)
      .doc(journalId)
      .collection(estimateConfig.subcollection)
      .doc(estimateId);

    try {
      const result = await db.runTransaction(async (transaction) => {
        const journalDoc = await transaction.get(
          db.collection(JOURNAL_COLLECTION).doc(journalId),
        );
        if (!journalDoc.exists) {
          throw new HttpsError("not-found", `Journal ${journalId} not found.`);
        }

        const journalData = journalDoc.data()!;
        if (
          !Object.prototype.hasOwnProperty.call(
            journalData.access ?? {},
            uid,
          ) ||
          !ROLES_THAT_ADD.has(journalData.access?.[uid]?.role)
        ) {
          throw new HttpsError(
            "permission-denied",
            "User does not have permission to convert estimates.",
          );
        }

        const estimateDoc = await transaction.get(estimateRef);
        if (!estimateDoc.exists) {
          throw new HttpsError(
            "not-found",
            `Estimate ${estimateId} not found.`,
          );
        }

        const estimateData = estimateDoc.data()!;
        const estimateDetails = estimateData.details as estimateDetailsState;

        // Validate status before conversion
        if (estimateDetails.status !== "Accepted") {
          throw new HttpsError(
            "failed-precondition",
            `Estimate cannot be converted with status: ${estimateDetails.status}.`,
          );
        }

        const invoiceNumber =
          estimateDetails.invoiceNumber || generateInvoiceNumber();
        let dueDate = estimateDetails.dueDate;
        if (!dueDate) {
          const newDueDate = new Date();
          newDueDate.setDate(newDueDate.getDate() + 30);
          dueDate = newDueDate;
        }

        const updatePayload = {
          "details.status": "Pending",
          "details.invoiceNumber": invoiceNumber,
          "details.dueDate": dueDate,
          "details.payments": estimateDetails.payments || [],
          updatedAt: FieldValue.serverTimestamp(),
        };

        transaction.update(estimateRef, updatePayload);

        return {
          success: true,
          invoiceId: estimateId,
          invoiceNumber,
          dueDate: dueDate.toISOString(),
          status: "Pending",
        };
      });

      logger.info(
        `Estimate ${estimateId} successfully converted to an Invoice.`,
        result,
      );
      return result;
    } catch (error) {
      logger.error("Error in convertEstimateToInvoiceFn:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        "internal",
        "An unexpected error occurred during the conversion.",
      );
    }
  },
);
