// frontend/src/lib/db_handler.tsx
import { useState, useEffect } from "react";
import {
  collection,
  doc,
  query,
  where,
  onSnapshot,
  getDocs,
  getDoc,
  getFirestore,
  connectFirestoreEmulator,
  orderBy,
  limit,
  startAfter,
  DocumentData,
  QueryConstraint,
} from "firebase/firestore";
import { app, emulatorIP } from "@/lib/auth_handler";
import { DBentry, DBentryMap, Journal } from "./custom_types"; // Use updated types
// --- Import Shared Constants ---
import {
  JOURNAL_COLLECTION,
  ENTRY_CONFIG,
  EntryType,
} from "@/lib/config_shared"; // Updated imports
import { JournalSchema } from "@backend/common/schemas/JournalSchema";

export const db = getFirestore(app);

if (process.env.NODE_ENV === "development") {
  connectFirestoreEmulator(db, emulatorIP, 8080);
}

// Helper to get subcollection config
function getEntryConfig(entryType: EntryType) {
  const config = ENTRY_CONFIG[entryType as keyof typeof ENTRY_CONFIG]; // Cast is safe due to EntryType definition
  if (!config) {
    console.error(`Invalid entryType provided: ${entryType}`);
    return null;
  }
  return config;
}

// Frontend parsing helpers to enforce strict types and validate data without `any`.
export function parseDBEntry(id: string, entryType: EntryType, data: DocumentData): DBentry {
  const config = getEntryConfig(entryType);
  let validatedDetails =
    data.details && typeof data.details === "object" ? data.details : {};

  if (config && config.schema) {
    const parsedValidDetails = config.schema.safeParse(data.details);
    if (parsedValidDetails.success) {
      validatedDetails = parsedValidDetails.data;
    } else {
      console.warn(
        `Validation failed for details of ${entryType} entry ${id}:`,
        parsedValidDetails.error.issues,
      );
    }
  }

  // Construct standard DBentry
  const entry: DBentry = {
    id,
    entryType: entryType,
    name: String(data.name || ""),
    isActive: Boolean(data.isActive),
    createdBy: String(data.createdBy || ""),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    details: validatedDetails,
  };

  if (data.deletedAt !== undefined) entry.deletedAt = data.deletedAt;
  if (data.deletedBy !== undefined) entry.deletedBy = String(data.deletedBy);
  if (data.status !== undefined) entry.status = data.status;

  return entry;
}

export function parseJournalDoc(id: string, data: DocumentData): Journal {
  const parsed = JournalSchema.safeParse({ ...data, id });
  if (parsed.success) {
    return {
      ...parsed.data,
      id,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    } as unknown as Journal;
  }

  console.warn(
    `Validation failed for journal ${id}:`,
    parsed.error.issues,
  );

  return {
    id,
    title: String(data.title || ""),
    journalType: data.journalType,
    details: data.details,
    access: data.access || {},
    access_array: Array.isArray(data.access_array) ? data.access_array : [],
    pendingAccess: data.pendingAccess,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    isActive: Boolean(data.isActive),
  } as Journal;
}

// --- fetchDateRangeEntries ---
// Now requires entryType and assumes the sort field exists in details
export async function fetchDateRangeEntries(
  journalId: string | null,
  entryType: EntryType, // --- ADD entryType ---
  from: Date | undefined,
  to: Date | undefined,
): Promise<DBentry[]> {
  if (!journalId || !from || !to) {
    return [];
  }

  const config = getEntryConfig(entryType);
  if (
    !config ||
    !config.sortField
  ) {
    console.error(
      `Date range fetch not supported or configured (or sortField missing/invalid) for entryType: ${entryType}`,
    );
    return [];
  }
  const subcollectionName = config.subcollection;
  const dateSortField = config.sortField; // e.g., "details.date"

  try {
    const colPath = `${JOURNAL_COLLECTION}/${journalId}/${subcollectionName}`;

    // add a day to 'to' to make the range inclusive of the end date
    to = new Date(to);
    to.setHours(23, 59, 59, 999);

    from = new Date(from);
    from.setHours(0, 0, 0, 0);

    const q = query(
      collection(db, colPath),
      where("isActive", "==", true),
      orderBy(dateSortField, "desc"), // Use dynamic sort field
      where(dateSortField, ">=", from),
      where(dateSortField, "<=", to),
    );

    const querySnapshot = await getDocs(q);
    const docsList: DBentry[] = querySnapshot.docs.map((doc) =>
      parseDBEntry(doc.id, entryType, doc.data())
    );
    return docsList;
  } catch (error) {
    console.error(`fetchDateRangeEntries (${entryType}): error`, error);
    throw error;
  }
}

// --- fetchOlderEntrys ---
// Now requires entryType
export async function fetchOlderEntrys(
  journalId: string,
  entryType: EntryType, // --- ADD entryType ---
  oldestEntry: DBentry, // Use DBentry type
  past_k: number,
): Promise<DBentryMap> {
  // Return type updated
  const config = getEntryConfig(entryType);
  if (!config || !config.sortField) {
    // Added null check for sortField
    console.error(
      `Configuration or sortField missing for entryType: ${entryType}`,
    );
    return {};
  }
  const subcollectionName = config.subcollection;
  const primarySortField = config.sortField; // e.g., "details.date" or "createdAt"

  try {
    const colPath = `${JOURNAL_COLLECTION}/${journalId}/${subcollectionName}`;
    // Ensure oldestEntry has the required sort fields
    const primarySortValue = primarySortField.startsWith("details.")
      ? oldestEntry.details?.[primarySortField.split(".")[1]]
      : oldestEntry[primarySortField as keyof DBentry];

    // Assuming createdAt is always present for secondary sort, if not, this might need adjustment
    const secondarySortValue = oldestEntry.createdAt;

    if (
      primarySortValue ===
      undefined /* secondarySortValue can be undefined if not always present */
    ) {
      console.error("Oldest entry is missing sort field values", {
        primarySortField,
        primarySortValue,
        secondarySortValue, // Log this to see if it's the issue
        oldestEntry,
      });
      return {};
    }

    const queryConstraints: QueryConstraint[] = [
      where("isActive", "==", true),
      orderBy(primarySortField, "desc"),
      limit(past_k),
    ];

    // startAfter requires all orderBy fields. Since we only have one orderBy,
    // we only need one argument in startAfter.
    queryConstraints.push(startAfter(primarySortValue));

    const q = query(collection(db, colPath), ...queryConstraints);

    const querySnapshot = await getDocs(q);
    const docsDict: DBentryMap = {};
    querySnapshot.forEach((doc) => {
      docsDict[doc.id] = parseDBEntry(doc.id, entryType, doc.data());
    });
    return docsDict;
  } catch (error) {
    console.error(`fetchOlderEntrys (${entryType}): error`, error);
    throw error;
  }
}

// --- useEntriesSubCol ---
// Now requires entryType
export function useEntriesSubCol(
  journalId: string,
  entryType: EntryType,
): DBentryMap {
  // Return type updated
  const [docs, setDocs] = useState<DBentryMap>({}); // Use updated type
  const FETCH_LIMIT = 20;

  useEffect(() => {
    // Reset docs when journalId or entryType changes
    setDocs({});

    const config = getEntryConfig(entryType);
    if (!journalId || !config || !config.sortField) {
      // Added null check for sortField
      console.warn(
        `useEntriesSubCol: Invalid journalId, entryType (${entryType}), or sortField missing`,
      );
      return () => {}; // Return empty cleanup
    }
    const subcollectionName = config.subcollection;
    const primarySortField = config.sortField;

    // Initialize unsubscribe function that will be assigned by onSnapshot
    // This ensures cleanup always works, even if the listener setup fails
    let unsubscribe: (() => void) | null = null;

    try {
      const colPath = `${JOURNAL_COLLECTION}/${journalId}/${subcollectionName}`;

      const q = query(
        collection(db, colPath),
        where("isActive", "==", true),
        orderBy(primarySortField, "desc"),
        limit(FETCH_LIMIT),
      );

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          setDocs((prevDocs) => {
            const newDocs = { ...prevDocs };
            let changed = false;
            snapshot.docChanges().forEach((change) => {
              const docData = parseDBEntry(change.doc.id, entryType, change.doc.data());
              if (change.type === "added" || change.type === "modified") {
                if (
                  JSON.stringify(newDocs[change.doc.id]) !==
                  JSON.stringify(docData)
                ) {
                  newDocs[change.doc.id] = docData;
                  changed = true;
                }
              } else if (change.type === "removed") {
                if (newDocs[change.doc.id]) {
                  delete newDocs[change.doc.id];
                  changed = true;
                }
              }
            });
            return changed ? newDocs : prevDocs;
          });
        },
        (error) => {
          console.error(`Error watching collection ${colPath}: `, error);
          setDocs({});
        },
      );
    } catch (error) {
      console.error(`useEntriesSubCol (${entryType}): setup error`, error);
      setDocs({});
    }

    return () => {
      if (unsubscribe) {
        try {
          unsubscribe();
        } catch (cleanupError) {
          console.error(
            `Error during unsubscribe for ${entryType}:`,
            cleanupError,
          );
        }
      }
    };
  }, [journalId, entryType]); // Re-run effect if journalId or entryType changes

  return docs;
}

// --- useWatchJournal ---
// Path updated to JOURNAL_COLLECTION
export function useWatchJournal(journalId: string | null) {
  const [journal, setJournal] = useState<Journal | undefined | null>(
    undefined,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setJournal(undefined);
    setLoading(true);

    if (!journalId) {
      setLoading(false);
      setJournal(null);
      return () => {};
    }

    const docRef = doc(db, JOURNAL_COLLECTION, journalId);

    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setJournal(parseJournalDoc(docSnap.id, docSnap.data()));
        } else {
          console.warn(`Journal ${journalId} not found.`);
          setJournal(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error(`Error watching journal ${journalId}: `, error);
        setJournal(null);
        setLoading(false);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [journalId]);

  return { journal, loading };
}

// --- fetchJournals ---
// Query simplified, filtering by type happens client-side if needed
export async function fetchJournals(userID: string): Promise<Journal[]> {
  try {
    const q = query(
      collection(db, JOURNAL_COLLECTION),
      where("isActive", "==", true),
      where("access_array", "array-contains", userID),
      orderBy("createdAt", "desc"),
    );

    const querySnapshot = await getDocs(q);
    const journals: Journal[] = querySnapshot.docs.map((doc) =>
      parseJournalDoc(doc.id, doc.data())
    );

    return journals;
  } catch (error) {
    console.error("Error fetching journals:", error);
    throw error;
  }
}

// --- fetchEntry ---
// Now requires entryType
export async function fetchEntry(
  journalId: string,
  entryType: EntryType,
  entryId: string,
): Promise<DBentry | null> {
  const config = getEntryConfig(entryType);
  if (!config) return null;
  const subcollectionName = config.subcollection;

  try {
    const docPath = `${JOURNAL_COLLECTION}/${journalId}/${subcollectionName}/${entryId}`;
    const docRef = doc(db, docPath);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return parseDBEntry(docSnap.id, entryType, docSnap.data());
    } else {
      return null;
    }
  } catch (error) {
    console.error(`Error getting entry (${entryType}): ${entryId}`, error);
    return null;
  }
}

// --- fetchJournal ---
// Path updated to JOURNAL_COLLECTION
export async function fetchJournal(
  journalId: string,
): Promise<Journal | null> {
  try {
    const docRef = doc(db, JOURNAL_COLLECTION, journalId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return parseJournalDoc(docSnap.id, docSnap.data());
    } else {
      return null;
    }
  } catch (error) {
    console.error(`Error getting journal document: ${journalId}`, error);
    return null;
  }
}
