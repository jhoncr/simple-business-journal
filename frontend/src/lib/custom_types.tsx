// frontend/src/lib/custom_types.tsx
import { Timestamp } from "firebase/firestore";
// Importing EntryType from the shared frontend configuration
import { EntryType, JOURNAL_TYPES, BusinessDetailsType } from "@/lib/config_shared";

// Definition for EntryItf copied from backend/functions/src/common/common_types.ts
// Note: Backend Timestamp from 'firebase-admin/firestore' is compatible with frontend 'firebase/firestore' Timestamp for data structure.
export interface EntryItf {
  name: string;
  isActive: boolean;
  deletedAt?: Timestamp; // Firestore Timestamp
  deletedBy?: string;
  createdBy: string;
  createdAt: Timestamp; // Firestore Timestamp
  updatedAt: Timestamp; // Firestore Timestamp
  details: {
    [key: string]: any;
  };
}

// Frontend specific User representation within an AccessMap
export interface AccessUser {
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
  role?: string; // e.g., "admin", "editor", "viewer" - consider using a shared enum/type if roles are predefined
}

// Frontend definition for AccessMap
export interface AccessMap {
  [uid: string]: AccessUser;
}

// Frontend definition for Journal
// This is manually defined to match expected structure, avoiding direct backend Zod dependency.
export interface Journal {
  id: string;
  title: string;
  journalType: (typeof JOURNAL_TYPES)[keyof typeof JOURNAL_TYPES]; // Use values from shared JOURNAL_TYPES
  details?: BusinessDetailsType | any; // Using BusinessDetailsType for business journals, 'any' for others for now
  access: AccessMap;
  access_array: string[]; // Array of UIDs that have access
  pendingAccess?: { [email: string]: string }; // Roles are strings like "admin", "viewer"
  createdAt: Timestamp; // Firestore Timestamp
  updatedAt?: Timestamp; // Firestore Timestamp (optional on frontend type)
  isActive: boolean;
}

export enum WorkStatus {
  DRAFT = "DRAFT",
  IN_PROCESS = "IN_PROCESS",
  DELIVERED = "DELIVERED",
}

// DBentry can extend the locally defined EntryItf
export interface DBentry extends Omit<EntryItf, "createdAt" | "updatedAt"> {
  id: string; // Firestore document ID
  // createdBy is already in EntryItf
  createdAt: Timestamp; // Firestore Timestamp
  updatedAt?: Timestamp; // Firestore Timestamp (optional)
  entryType?: EntryType; // From config_shared
  status?: WorkStatus;
  // details are already part of EntryItf
}

export interface DBentryMap {
  [id: string]: DBentry;
}
