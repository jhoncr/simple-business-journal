// frontend/src/lib/custom_types.tsx
import { z } from "zod";
import { Timestamp } from "firebase/firestore";
import { EntryItf } from "../../../backend/functions/src/common/common_types";
// --- Import backend types if possible, otherwise redefine/simplify ---
import {
  JournalSchemaType,
  AccessMap as BackendAccessMap,
} from "../../../backend/functions/src/common/schemas/JournalSchema";
import { EntryType } from "../../../backend/functions/src/common/schemas/configmap";

// Keep User type simple on frontend if full details aren't always needed
export interface User {
  uid: string;
  displayName?: string | null; // Allow null
  email?: string | null; // Allow null
  photoURL?: string | null; // Allow null
  role?: string; // Role might be needed
}

// Use the imported backend AccessMap type or redefine if necessary
export type AccessMap = BackendAccessMap;
// export interface AccessMap {
//   [uid: string]: User;
// }

// --- Update Journal interface ---
// Align with backend JournalSchemaType, simplify if needed for frontend context
export interface Journal
  extends Omit<
    JournalSchemaType,
    "createdAt" | "updatedAt" | "access" | "pendingAccess"
  > {
  id: string;
  // Use JournalSchemaType properties directly:
  // title: string;
  // journalType: string; // Will be 'business', 'baby', etc.
  // details: any; // Keep as any for now, or use discriminated union if preferred frontend
  // access: AccessMap;
  // pendingAccess?: { [email: string]: string }; // Use optional and match backend role type
  // isActive: boolean;
  createdAt: Timestamp; // Keep timestamps if needed for display
  updatedAt?: Timestamp;
  access: AccessMap; // Explicitly include access
  pendingAccess?: { [email: string]: string }; // Optional pending access
}

// DBentry remains largely the same, represents an entry within a subcollection
export interface DBentry extends Omit<EntryItf, "createdAt" | "updatedAt"> {
  id: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp; // Add optional updatedAt
  entryType?: EntryType; // --- ADD entryType if needed when fetching generic lists ---
  // details are already part of EntryItf
}

export interface DBentryMap {
  [id: string]: DBentry;
}
