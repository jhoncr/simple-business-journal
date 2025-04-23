import React from "react";
import { EntryView, EntryViewProps } from "../../comp/EntryView";
import { DBentry, User } from "@/lib/custom_types";
import { formattedDate, formatCurrency } from "@/lib/utils";
import { Hammer, Package } from "lucide-react";
// No schema imports needed here if structure is assumed correct via props
import { EntryType } from "@/../../backend/functions/src/common/schemas/configmap";

// --- Update Props Interface (Align with EntryViewProps) ---
// This interface defines what InventoryItemEntry *expects* to receive.
interface InventoryItemEntryProps {
  journalId: string;
  entry: DBentry; // Should contain details adhering to materialItemSchema
  entryType: EntryType; // Will be 'inventory'
  user: User; // Creator info
  role: string; // Viewer's role
  removeFn: (entry: DBentry) => void;
}

// --- Details Component (Remains mostly the same) ---
// Renders the specific details of the inventory item
const InventoryItemDetails = ({ entry }: { entry: DBentry }) => {
  // Assume entry.details matches materialItemSchema structure
  const { name } = entry; // Use top-level name if available (added in form refactor)
  const { description, unitPrice, labor, dimensions, currency } =
    entry.details || {}; // Destructure safely

  // Handle cases where details might be missing (though schema validation should prevent this)
  if (!dimensions || unitPrice === undefined || currency === undefined) {
    console.error("Inventory item details incomplete:", entry);
    return (
      <div className="text-red-500 text-xs">Error: Incomplete item data.</div>
    );
  }

  // Format currency (using util function)
  const displayPrice = formatCurrency(unitPrice, currency);
  const displayUnit = dimensions.unitLabel || "unit"; // Fallback if unitLabel missing

  // Function to get the appropriate material rate display
  const getLaborRateDisplay = (
    laborType: string,
    rate: number,
    itemCurrency: string, // Renamed to avoid conflict
    itemDimensions: { unitLabel?: string },
  ): string => {
    const formattedRate = formatCurrency(rate, itemCurrency);
    const laborUnit = itemDimensions.unitLabel || "unit";

    switch (laborType) {
      case "percentage":
        return `${rate}%`; // Percentage doesn't need currency symbol
      case "fixed":
        return `fixed at ${formattedRate}`;
      case "quantity":
        // Use specific unit label from dimensions if available
        return `${formattedRate} per ${laborUnit}`;
      default:
        return `${rate}`; // Fallback
    }
  };

  return (
    <div className="w-full border-0">
      <div className="flex justify-between items-start gap-2">
        {" "}
        {/* Added gap */}
        {/* Left side: Name and description */}
        <div className="flex-1 min-w-0">
          {" "}
          {/* Allow shrinking/wrapping */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {" "}
            {/* Allow wrapping */}
            <span className="flex items-center gap-1">
              <Package className="h-4 w-4 text-muted-foreground" />{" "}
              {/* Icon */}
              <p className="text-base font-medium truncate" title={name}>
                {name || "Unnamed Item"}
              </p>
            </span>
            {/* <p className="text-xs text-muted-foreground">
               Added: {formattedDate(entry.createdAt)} {/* Use createdAt */}
            {/* </p> */}
          </div>
          {description && ( // Only show description if it exists
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        {/* Right side: Price */}
        <div className="flex flex-col items-end flex-shrink-0">
          {" "}
          {/* Prevent shrinking */}
          <p className="font-semibold">{displayPrice}</p>
          <p className="text-xs text-muted-foreground">per {displayUnit}</p>
        </div>
      </div>

      {/* Bottom: Labor info */}
      {labor && (
        <div className="flex flex-row justify-start items-center gap-2 mt-2 text-xs text-muted-foreground border border-dashed rounded px-2 py-1 w-fit">
          {" "}
          {/* Fit content */}
          <Hammer className="h-3 w-3" /> {/* Smaller icon */}
          <span>
            {"Labor: "}
            {getLaborRateDisplay(
              labor.laborType,
              labor.laborRate,
              currency, // Pass currency
              dimensions, // Pass dimensions
            )}
          </span>
          {/* Optional: Show labor description if needed */}
          {/* {labor.description && <span className="italic">({labor.description})</span>} */}
        </div>
      )}
    </div>
  );
};

// --- Main Component ---
export const InventoryItemEntry = React.memo(function InventoryItemEntry({
  journalId,
  entry,
  entryType,
  user, // Creator info
  role, // Viewer's role
  removeFn,
}: InventoryItemEntryProps) {
  // Basic validation (already checked by parent, but good practice)
  if (!journalId || !entry || entryType !== "inventory") return null;

  return (
    // Pass all necessary props *up* to EntryView
    <EntryView
      journalId={journalId}
      entry={entry}
      entryType={entryType} // Pass entryType
      user={user} // Pass creator info
      role={role} // Pass viewer role
      removeFn={removeFn}
    >
      {/* Render the specific details as children */}
      <InventoryItemDetails entry={entry} />
    </EntryView>
  );
});
