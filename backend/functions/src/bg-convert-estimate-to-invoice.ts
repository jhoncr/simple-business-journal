// backend/functions/src/bg-convert-estimate-to-invoice.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initializeApp, getApps } from "firebase-admin/app";
import { JOURNAL_COLLECTION, ROLES_THAT_ADD } from "./common/const"; // Assuming ROLES_THAT_ADD is appropriate, or define new role check
import { ENTRY_CONFIG } from "./common/schemas/configmap";
import { ALLOWED } from "./lib/bg-consts"; // For CORS
import { estimateDetailsStateSchema } from "./common/schemas/estimate_schema"; // For type hint and calculation
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

    try {
      const journalDocRef = db.collection(JOURNAL_COLLECTION).doc(journalId);
      const journalDoc = await journalDocRef.get();

      if (!journalDoc.exists) {
        throw new HttpsError("not-found", `Journal ${journalId} not found.`);
      }
      const journalData = journalDoc.data() || {};
      // Check user's role for permission (adjust role check as needed)
      if (
        !Object.prototype.hasOwnProperty.call(journalData.access ?? {}, uid) ||
        !ROLES_THAT_ADD.has(journalData.access?.[uid]?.role) // Or a more specific role like 'editor' or 'admin'
      ) {
        throw new HttpsError(
          "permission-denied",
          "User does not have permission to convert estimates in this journal.",
        );
      }

      const estimateConfig = ENTRY_CONFIG.estimate; // Only need estimate config

      const estimateRef = journalDocRef
        .collection(estimateConfig.subcollection)
        .doc(estimateId);

      return await db.runTransaction(async (transaction) => {
        const estimateDoc = await transaction.get(estimateRef);
        if (!estimateDoc.exists) {
          throw new HttpsError(
            "not-found",
            `Estimate ${estimateId} not found.`,
          );
        }

        const estimateDetails = estimateDoc.data()?.details;
        const initialParsedDetails =
          estimateDetailsStateSchema.safeParse(estimateDetails);

        if (!initialParsedDetails.success) {
          logger.error(
            "Initial estimate details failed validation",
            initialParsedDetails.error.format(),
          );
          throw new HttpsError(
            "internal",
            "Estimate data is invalid before conversion.",
          );
        }
        const currentDetails = initialParsedDetails.data;

        // Idempotency check: If already an invoice (e.g. has invoice number and status is Pending/Paid/Overdue)
        // and meets certain criteria, maybe just return existing data.
        // For now, we allow re-running to ensure status/archival is set, but invoice number/due date are preserved if existing.
        if (
          currentDetails.status !== "Accepted" &&
          currentDetails.status !== "Estimate" &&
          currentDetails.status !== "Draft" &&
          currentDetails.status !== "Pending"
        ) {
          // Allow conversion from Pending too, in case of re-trigger or specific flows.
          // If it's already Paid, Rejected, Cancelled, etc., don't convert.
          if (
            currentDetails.invoiceNumber &&
            (currentDetails.status === "Paid" ||
              currentDetails.status === "Overdue" ||
              currentDetails.status === "Cancelled" ||
              currentDetails.status === "Rejected")
          ) {
            throw new HttpsError(
              "failed-precondition",
              `Estimate is already an invoice with status ${currentDetails.status} and cannot be re-converted this way.`,
            );
          }
        }

        const updatedDetails: any = { ...currentDetails }; // Create a mutable copy

        // 1. Set Invoice Number
        if (!updatedDetails.invoiceNumber) {
          updatedDetails.invoiceNumber = generateInvoiceNumber();
        }

        // 2. Set Due Date
        if (!updatedDetails.dueDate) {
          const newDueDate = new Date();
          newDueDate.setDate(newDueDate.getDate() + 30); // Default 30 days from now
          updatedDetails.dueDate = newDueDate; // Store as Date object, Firestore will convert to Timestamp
        } else {
          // Ensure existing dueDate is a Date object if it's a string/Timestamp
          updatedDetails.dueDate = new Date(updatedDetails.dueDate);
        }

        // 3. Initialize Payments array
        if (
          updatedDetails.payments === undefined ||
          updatedDetails.payments === null
        ) {
          updatedDetails.payments = [];
        }

        // 4. Set Status
        updatedDetails.status = "Pending"; // New status for the invoice

        // 5. Set is_archived (as per prompt, estimate aspect is archived)
        // This field's meaning might need review in a unified schema.
        // If it means "this estimate record is now an invoice and should not appear in 'estimates only' list", then true.
        // If it means "this invoice is archived", then false.
        // Following prompt's intention for "archiving the estimate aspect".
        updatedDetails.is_archived = true;

        // 6. Set invoiceId_ref (points to itself as it's now an invoice)
        updatedDetails.invoiceId_ref = estimateId;

        // Validate final details before saving
        const finalParsedDetails =
          estimateDetailsStateSchema.safeParse(updatedDetails);
        if (!finalParsedDetails.success) {
          logger.error(
            "Updated invoice details failed validation",
            finalParsedDetails.error.format(),
          );
          throw new HttpsError(
            "internal",
            "Failed to prepare valid invoice data.",
          );
        }

        transaction.update(estimateRef, {
          details: finalParsedDetails.data,
          isActive: true, // Ensure the entry remains active as an invoice
          updatedAt: FieldValue.serverTimestamp(),
          // Optionally update 'name' if it should change, e.g., "Invoice #XYZ"
          // name: `Invoice ${finalParsedDetails.data.invoiceNumber}`
        });

        logger.info(
          `Estimate ${estimateId} successfully converted/updated to an Invoice. Invoice Number: ${finalParsedDetails.data.invoiceNumber}`,
        );

        return {
          success: true,
          invoiceId: estimateId, // It's the same document ID
          invoiceNumber: finalParsedDetails.data.invoiceNumber,
          dueDate: (
            finalParsedDetails.data?.dueDate ?? new Date()
          ).toISOString(), // Return ISO string to frontend
          status: finalParsedDetails.data.status,
        };
      });
    } catch (error) {
      logger.error("Error in convertEstimateToInvoiceFn:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        "internal",
        "An unexpected error occurred during estimate to invoice conversion.",
      );
    }
  },
);
