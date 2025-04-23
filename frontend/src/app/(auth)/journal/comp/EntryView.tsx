// frontend/src/app/(auth)/journal/comp/EntryView.tsx
import React, { memo } from "react";
import { DBentry, User } from "@/lib/custom_types"; // Keep using DBentry
import { ROLES_CAN_DELETE } from "@/../../backend/functions/src/common/const";
import { DeleteEntryBtn } from "../actions/delete-entry";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical } from "lucide-react";
import { EntryType } from "@/../../backend/functions/src/common/schemas/configmap"; // Import EntryType

// --- Update Props ---
export interface EntryViewProps<T extends DBentry> {
  journalId: string; // Use journalId for clarity
  entry: T;
  entryType: EntryType; // --- ADD entryType prop ---
  user: User; // User who created the entry (from access map)
  role: string; // Role of the *logged-in* user viewing the entry
  removeFn: (entry: T) => void; // Callback for UI removal
  children: React.ReactNode; // Type-specific content
}

export const EntryView = memo(function EntryView<T extends DBentry>({
  journalId, // Get journalId
  entry,
  entryType, // --- Get entryType ---
  user,
  role, // This is the viewing user's role
  removeFn,
  children,
}: EntryViewProps<T>) {
  return (
    // Consider adding data attributes for easier testing/styling
    <div
      className="pl-4 pb-2 w-full border-t border-border pt-2"
      data-entry-id={entry.id}
      data-entry-type={entryType}
    >
      <div className="flex items-start justify-between">
        <div className="flex-grow pr-2">
          {" "}
          {/* Add padding right */}
          {children} {/* Render type-specific details here */}
        </div>

        {/* --- Check role for delete permission --- */}
        {ROLES_CAN_DELETE.has(role) && (
          <div className="flex-shrink-0 ml-auto" id={`entry-menu-${entry.id}`}>
            {" "}
            {/* Use ml-auto */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive focus:bg-destructive/10 p-0" // Remove default padding
                  onSelect={(e) => e.preventDefault()} // Prevent default close/action
                >
                  {/* --- Pass props to DeleteEntryBtn --- */}
                  <DeleteEntryBtn
                    journalId={journalId} // Pass journalId
                    entryId={entry.id}
                    entryType={entryType} // --- Pass entryType ---
                    entryName={entry.name || entryType} // Pass entry name or type
                    onDeleted={() => removeFn(entry)}
                  />
                </DropdownMenuItem>
                {/* Add Edit option here later if needed */}
                {/* <DropdownMenuItem>Edit</DropdownMenuItem> */}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </div>
  );
});
