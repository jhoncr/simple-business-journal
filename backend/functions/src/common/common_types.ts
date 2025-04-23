import { AccessMap } from "./schemas/common_schemas";
import { Timestamp } from "firebase-admin/firestore";

export interface EntryItf {
  name: string;
  isActive: boolean;
  deletedAt?: Timestamp;
  deletedBy?: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  details: {
    [key: string]: any;
  };
}

export enum JournalRole {
  "admin",
  "editor",
  "staff",
  "viewer",
}

export interface JournalUser {
  displayName: string;
  role: JournalRole;
  email: string;
  photoURL: string;
}

export interface JournalDocument {
  id?: string; // only for the UI, the UI library hydrates the doc with the document ID
  title: string;
  journalType: string;
  status: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  access: AccessMap;
  pendingAccess: {
    [email: string]: JournalRole;
  };
}
