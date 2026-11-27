import { Timestamp } from 'firebase-admin/firestore';

export enum WorkStatus {
  DRAFT = 'DRAFT',
  IN_PROCESS = 'IN_PROCESS',
  DELIVERED = 'DELIVERED',
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
    // Entry details vary by entryType (estimate vs template) and are validated via Zod schemas.
    [key: string]: any;
  };
}
