// backend/functions/src/bg-convert-estimate-to-invoice.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initializeApp, getApps } from "firebase-admin/app";
import { JOURNAL_COLLECTION, ROLES_THAT_ADD } from "./common/const"; // Assuming ROLES_THAT_ADD is appropriate, or define new role check
import { ENTRY_CONFIG } from "./common/schemas/configmap";
import { ALLOWED } from "./lib/bg-consts"; // For CORS
import { estimateDetailsStateSchema, LineItem, Adjustment } from "./common/schemas/estimate_schema"; // For type hint and calculation
import { invoiceDetailsSchema } from "./common/schemas/invoice_schema"; // For type hint and validation

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

// Basic invoice number generation (example: INV-YYYYMMDD-HHMMSS)
// For a robust solution, consider a dedicated counter document or more sophisticated unique ID generation.
function generateInvoiceNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  return `INV-${year}${month}${day}-${hours}${minutes}${seconds}`;
}

// Helper function to calculate totals, mimicking frontend logic
function _calculateInvoiceTotalInternal(
  lineItems: LineItem[], // Use the imported LineItem type
  adjustments: Adjustment[], // Use the imported Adjustment type
  taxPercentage: number
): number { // Returns only the grandTotal, as that's what invoice schema needs for totalAmount
  const itemsTotal = lineItems.reduce((sum, item) => {
    const quantity = item.quantity || 0;
    const unitPrice = item.material?.unitPrice || 0; // Safely access nested properties
    return sum + quantity * unitPrice;
  }, 0);

  const adjustmentsTotal = adjustments.reduce((sum, adj) => {
    const value = adj.value || 0;
    let adjustmentValue = 0;
    switch (adj.type) {
      case "addFixed":
        adjustmentValue = value;
        break;
      case "discountFixed":
        adjustmentValue = -value;
        break;
      case "addPercent":
        // Ensure itemsTotal is not zero to avoid NaN if value is also zero, though multiplication handles it.
        adjustmentValue = (itemsTotal * value) / 100;
        break;
      case "discountPercent":
        adjustmentValue = -(itemsTotal * value) / 100;
        break;
      // 'taxPercent' type adjustments are not summed directly into adjustmentsTotal here,
      // as taxPercentage field is used for the final tax calculation.
      // If 'taxPercent' type adjustments *should* be part of adjustmentsTotal, this logic needs change.
      // Based on frontend, 'taxPercent' in adjustments array is ignored for this subtotal.
    }
    return sum + adjustmentValue;
  }, 0);

  const subtotalBeforeTax = itemsTotal + adjustmentsTotal;
  const taxAmount = (subtotalBeforeTax * (taxPercentage || 0)) / 100; // Use taxPercentage from estimate details
  const grandTotal = subtotalBeforeTax + taxAmount;

  // It's good practice to round to a sensible number of decimal places for currency.
  // Assuming 2 decimal places.
  return Math.round(grandTotal * 100) / 100;
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

      const estimateConfig = ENTRY_CONFIG.estimate;
      const invoiceConfig = ENTRY_CONFIG.invoice;

      const estimateRef = journalDocRef
        .collection(estimateConfig.subcollection)
        .doc(estimateId);

      const invoiceCollectionRef = journalDocRef.collection(invoiceConfig.subcollection);

      return await db.runTransaction(async (transaction) => {
        const estimateDoc = await transaction.get(estimateRef);
        if (!estimateDoc.exists) {
          throw new HttpsError(
            "not-found",
            `Estimate ${estimateId} not found.`,
          );
        }

        const estimateData = estimateDoc.data()!; // Assert estimateData is not null, as estimateDoc.exists is true
        // Validate estimate data (optional, but good practice)
        const parsedEstimate = estimateDetailsStateSchema.safeParse(estimateData.details);
        if (!parsedEstimate.success) {
            logger.error("Estimate data failed validation", parsedEstimate.error.format());
            throw new HttpsError("internal", "Estimate data is invalid.");
        }
        const validEstimateDetails = parsedEstimate.data;

        if (validEstimateDetails.is_archived || validEstimateDetails.invoiceId_ref) {
          throw new HttpsError(
            "failed-precondition",
            "Estimate is already archived or converted to an invoice.",
          );
        }

        // Check if estimate status allows conversion (e.g., must be 'accepted')
        if (validEstimateDetails.status !== 'accepted') {
            throw new HttpsError(
                "failed-precondition",
                `Estimate status must be 'accepted' to convert. Current status: ${validEstimateDetails.status}.`
            );
        }

        const invoiceNumber = generateInvoiceNumber();
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30); // Due 30 days from now

        // Calculate totalAmount using the helper function
        const calculatedTotalAmount = _calculateInvoiceTotalInternal(
          validEstimateDetails.confirmedItems || [], // Pass confirmedItems as lineItems, ensure it's an array
          validEstimateDetails.adjustments || [],   // Ensure adjustments is an array
          validEstimateDetails.taxPercentage || 0 // Pass taxPercentage, default to 0
        );

        const newInvoiceDetails = {
          invoiceNumber: invoiceNumber,
          estimateId_ref: estimateId,
          dueDate: dueDate.toISOString(), // Store as ISO string
          paymentStatus: "pending" as const,
          customer: validEstimateDetails.customer,
          supplier: validEstimateDetails.supplier,
          lineItems: validEstimateDetails.confirmedItems || [], // Assuming lineItems are compatible
          adjustments: validEstimateDetails.adjustments || [], // Assuming adjustments are compatible
          currency: validEstimateDetails.currency,
          notes: validEstimateDetails.notes,
          totalAmount: calculatedTotalAmount, // USE THE CALCULATED VALUE HERE
          entryType: "invoice" as const, // Added entryType for invoice
          // paymentDetails: null, // Explicitly null or undefined
        };

        // Validate the new invoice details before saving
        // The schema now expects entryType: "invoice"
        const validatedInvoiceDetails = invoiceDetailsSchema.parse(newInvoiceDetails);

        // Create the invoice entry structure
        const newInvoiceEntry = {
            name: `Invoice based on Estimate #${estimateData.name || estimateId}`, // Updated name
            isActive: true,
            createdBy: uid,
            details: validatedInvoiceDetails, // details now includes entryType: "invoice"
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        };

        const newInvoiceRef = invoiceCollectionRef.doc(); // Auto-generate ID
        transaction.set(newInvoiceRef, newInvoiceEntry);

        // Archive the estimate
        transaction.update(estimateRef, {
          "details.is_archived": true,
          "details.invoiceId_ref": newInvoiceRef.id,
          "details.status": "invoiced", // New status for estimate
          isActive: false, // Also set top-level isActive to false
          updatedAt: FieldValue.serverTimestamp(),
        });

        logger.info(
          `Estimate ${estimateId} converted to Invoice ${newInvoiceRef.id}. Invoice number: ${invoiceNumber}`,
        );
        return {
          result: "ok",
          message: "Estimate successfully converted to invoice.",
          invoiceId: newInvoiceRef.id,
          invoiceNumber: invoiceNumber,
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
