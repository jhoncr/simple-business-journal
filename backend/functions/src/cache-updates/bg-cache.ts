// backend/functions/src/cache-updates/bg-cache.ts
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { Firestore, getFirestore, FieldValue } from "firebase-admin/firestore";
import { initializeApp, getApps } from "firebase-admin/app";
import { EntryItf } from "../common/common_types";
import { materialItemSchema } from "../common/schemas/InventorySchema";
import { handleSchemaValidationError } from "../lib/bg-consts";
import { JOURNAL_COLLECTION, JOURNAL_TYPES } from "../common/const";
import { ENTRY_CONFIG } from "../common/schemas/configmap";
import * as logger from "firebase-functions/logger";

if (getApps().length === 0) {
  initializeApp();
}

const db: Firestore = getFirestore();

const INVENTORY_SUBCOLLECTION = ENTRY_CONFIG.inventory.subcollection;

/**
 * triggered /journals/{journalId}/inventory_items collection is created or updated.
 * It updates the parent journal document with a cache of active inventory items.
 */
export const onInventoryEntryWrite = onDocumentWritten(
  `${JOURNAL_COLLECTION}/{journalId}/${INVENTORY_SUBCOLLECTION}/{itemId}`,
  async (event) => {
    const { journalId, itemId } = event.params;
    const entryDataAfter = (event.data?.after.data() ||
      null) as EntryItf | null;
    const entryDataBefore = (event.data?.before.data() ||
      null) as EntryItf | null;

    if (!entryDataAfter && !entryDataBefore) {
      logger.warn(
        `∅ No data found for item ${itemId} in journal ${journalId}. Skipping update.`,
      );
      return;
    }

    // Get the parent journal document
    const journalDocRef = db.collection(JOURNAL_COLLECTION).doc(journalId);
    const journalDoc = await journalDocRef.get();

    if (!journalDoc.exists) {
      logger.warn(
        `∅ Parent journal document ${journalId} does not exist. Cannot update cache for item ${itemId}.`,
      );
      return;
    }

    const journalData = journalDoc.data();
    if (journalData?.journalType !== JOURNAL_TYPES.BUSINESS) {
      logger.info(
        `Journal ${journalId} is not a business journal (type: ${journalData?.journalType}).` +
          ` Skipping inventory cache update for item ${itemId}.`,
      );
      return;
    }

    logger.info(
      `Inventory item written in journal ${journalId}, itemId: ${itemId}. Updating cache.`,
    );

    // Determine if it's a delete/deactivation or an add/update
    const isDeletion = !entryDataAfter || entryDataAfter.isActive === false;

    if (isDeletion) {
      logger.info(
        `Deleting activeItems cache for item ${itemId} in journal ${journalId}`,
      );
      try {
        await journalDocRef.update({
          [`inventoryCache.${itemId}`]: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        logger.info(
          `Cache updated successfully for deletion of item ${itemId} in journal ${journalId}.`,
        );
      } catch (error) {
        logger.error(
          `Error deleting item ${itemId} from cache in journal ${journalId}:`,
          error,
        );
      }
    } else {
      // Validate that entryDataAfter is still a valid inventory item entry
      const detailsResult = materialItemSchema.safeParse(
        entryDataAfter.details,
      );
      if (!detailsResult.success) {
        // Use utility function - maybe pass 'inventory' type explicitly
        handleSchemaValidationError("inventory", detailsResult);
        logger.error(
          `Invalid details for inventory item ${itemId} in journal ${journalId}. Aborting cache update.`,
        );
        return; // Don't update cache if details are invalid
      }

      // Prepare the cache entry - potentially simplify it if needed
      // For now, storing the whole entry might be fine
      const cacheEntry = {
        ...entryDataAfter, // Includes details, createdBy, timestamps etc.
        // You could simplify this to only store essential fields for the frontend if needed:
        // name: entryDataAfter.name,
        // details: validatedDetails, // Use validated details if needed
        // createdBy: entryDataAfter.createdBy,
        // createdAt: entryDataAfter.createdAt,
        // updatedAt: entryDataAfter.updatedAt
      };

      logger.info(
        `Updating inventoryCache for item ${itemId} in journal ${journalId} with data: ${JSON.stringify(
          cacheEntry,
        )}`,
      );
      try {
        await journalDocRef.update({
          [`inventoryCache.${itemId}`]: cacheEntry,
          updatedAt: FieldValue.serverTimestamp(),
        });
        logger.info(
          `Cache updated successfully for item ${itemId} in journal ${journalId}.`,
        );
      } catch (error) {
        logger.error(
          `Error updating cache for item ${itemId} in journal ${journalId}:`,
          error,
        );
      }
    }
  },
);
