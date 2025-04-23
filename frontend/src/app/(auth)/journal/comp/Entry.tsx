// frontend/src/app/(auth)/journal/comp/Entry.tsx
import React, { memo } from "react";
import { DBentry, User } from "../../../../lib/custom_types";
import { getEntryComponent } from "../journal-types/config";
import { EntryType } from "@/../../backend/functions/src/common/schemas/configmap"; // Import EntryType

// --- Update Props ---
export interface EntryProps {
  // Renamed from EntryViewProps to avoid confusion
  journalId: string; // --- ADD journalId ---
  entryType: EntryType; // --- ADD entryType ---
  entry: DBentry;
  user: User; // Creator user info
  role: string; // Logged-in user's role
  removeFn: (entry: DBentry) => void;
}

export const Entry = memo(function Entry({
  journalId, // Get props
  entryType,
  entry,
  user,
  role,
  removeFn,
}: EntryProps) {
  // Use updated props type
  // --- Determine Component based on entryType ---
  const ViewComponent = getEntryComponent(entryType); // Use entryType

  if (!ViewComponent) {
    console.warn(`No component configured for entry type: ${entryType}`);
    return (
      <div className="pl-4 text-sm text-red-500">
        Error: Unknown entry type {entryType}
      </div>
    );
  }

  // Dynamically render the component, passing necessary props
  return React.createElement(
    ViewComponent as React.ComponentType<any>, // Use 'any' or a more generic prop type if needed
    {
      journalId, // Pass down
      entry,
      entryType, // Pass down
      user,
      role,
      removeFn,
    },
  );
});
