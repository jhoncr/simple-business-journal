import { AccessMap } from './schemas/common_schemas';
import { Timestamp } from 'firebase-admin/firestore';
import { ROLES } from './schemas/common_schemas'; // Import ROLES

export enum WorkStatus {
  DRAFT = "DRAFT",
  IN_PROCESS = "IN_PROCESS",
  DELIVERED = "DELIVERED",
}

export interface EntryItf {
  name: string;
  isActive: boolean;
  deletedAt?: Timestamp;
  deletedBy?: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  status?: WorkStatus;
  details: {
    [key: string]: any;
  };
}

// Remove JournalRole enum
// export enum JournalRole {
//   "admin",
//   "editor",
//   "staff",
//   "viewer",
// }

export interface JournalUser {
  displayName: string;
  role: (typeof ROLES)[number]; // Use ROLES type
  email: string;
  photoURL: string;
}

export interface JournalDocument {
  id?: string; // only for the UI, the UI library hydrates the doc with the document ID
  title: string;
  journalType: string;
  // status: string; // Removed status field
  createdAt: Timestamp;
  updatedAt: Timestamp;
  access: AccessMap;
  pendingAccess: {
    [email: string]: (typeof ROLES)[number]; // Use ROLES type
  };
}
