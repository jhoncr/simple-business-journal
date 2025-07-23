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
  // endBefore, // Not currently used
  Firestore,
  DocumentData,
  Timestamp, // Import Timestamp
} from "firebase/firestore";
import { app, emulatorIP } from "@/lib/auth_handler";
import { DBentry, DBentryMap, Journal } from "./custom_types"; // Use updated types
// --- Import Shared Constants ---
import {
  JOURNAL_COLLECTION,
  ENTRY_CONFIG,
  EntryType,
} from "@/lib/config_shared"; // Updated imports

// --- Define Frontend ENTRY_CONFIG (or import if possible/preferred) --- // This comment block is now removed
// This avoids direct dependency if backend changes often, but requires duplication
// const FE_ENTRY_CONFIG = {
//   cashflow: { subcollection: "cashflow_entries", sortField: "details.date" },
//   inventory: { subcollection: "inventory_items", sortField: "createdAt" },
//   estimate: { subcollection: "estimates", sortField: "createdAt" },
//   nap: { subcollection: "naps", sortField: "details.start" },
//   diaper: { subcollection: "diapers", sortField: "details.time" },
//   feed: { subcollection: "feeds", sortField: "details.time" },
//   growth: { subcollection: "growth_entries", sortField: "details.date" },
// } as const;
// --- End Frontend ENTRY_CONFIG --- // This comment block is now removed

export const db = getFirestore(app);

if (process.env.NODE_ENV === "development") {
  console.log("Firestore connected to emulator");
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

// --- fetchDateRangeEntries ---
// Now requires entryType and assumes the sort field exists in details
export async function fetchDateRangeEntries(
  journalId: string | null,
  entryType: EntryType, // --- ADD entryType ---
  from: Date | undefined,
  to: Date | undefined,
): Promise<DBentry[]> {
  // Return type updated
  if (!journalId || !from || !to) {
    return [];
  }

  const config = getEntryConfig(entryType);
  if (
    !config ||
    !config.sortField ||
    !config.sortField.startsWith("details.")
  ) {
    // Added null check for sortField
    console.error(
      `Date range fetch not supported or configured (or sortField missing/invalid) for entryType: ${entryType}`,
    );
    return []; // Or throw error
  }
  const subcollectionName = config.subcollection;
  const dateSortField = config.sortField; // e.g., "details.date"

  try {
    const colPath = `${JOURNAL_COLLECTION}/${journalId}/${subcollectionName}`;
    const q = query(
      collection(db, colPath),
      where("isActive", "==", true),
      orderBy(dateSortField, "desc"), // Use dynamic sort field
      // orderBy("createdAt", "desc"), // Secondary sort
      where(dateSortField, ">=", from),
      where(dateSortField, "<=", to),
    );

    const querySnapshot = await getDocs(q);
    const docsList: DBentry[] = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      entryType: entryType, // Add entryType to result if needed
      ...(doc.data() as any), // Cast needed as data structure varies
    }));
    console.log(
      `Fetched ${docsList.length} ${entryType} entries for date range.`,
    );
    return docsList;
  } catch (error) {
    console.error(`fetchDateRangeEntries (${entryType}): error`, error);
    return [];
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
      ? (oldestEntry.details as any)?.[primarySortField.split(".")[1]]
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

    const queryConstraints: any[] = [
      where("isActive", "==", true),
      orderBy(primarySortField, "desc"),
      // orderBy("createdAt", "desc"), // Consider if this secondary sort is always needed/reliable
      limit(past_k),
    ];

    // startAfter requires all orderBy fields. If secondarySortValue is potentially undefined,
    // this might cause issues. For simplicity, if using only primarySortField in orderBy,
    // then startAfter should only use primarySortValue.
    // If 'createdAt' is a guaranteed secondary sort, it should be in orderBy.
    // For now, assuming primarySortValue is sufficient if secondary is problematic.
    if (secondarySortValue !== undefined) {
      queryConstraints.push(startAfter(primarySortValue, secondarySortValue));
    } else {
      queryConstraints.push(startAfter(primarySortValue));
    }

    const q = query(collection(db, colPath), ...queryConstraints);

    const querySnapshot = await getDocs(q);
    const docsDict: DBentryMap = {};
    querySnapshot.forEach((doc) => {
      docsDict[doc.id] = {
        id: doc.id,
        entryType: entryType, // Add entryType
        ...(doc.data() as any),
      } as DBentry;
    });
    console.log(
      `Fetched ${Object.keys(docsDict).length} older ${entryType} entries.`,
    );
    return docsDict;
  } catch (error) {
    console.error(`fetchOlderEntrys (${entryType}): error`, error);
    return {};
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

    let unsubscribe = () => {};

    try {
      const colPath = `${JOURNAL_COLLECTION}/${journalId}/${subcollectionName}`;
      console.log(
        `Watching entries in: ${colPath} ordered by ${primarySortField}`,
      );

      const q = query(
        collection(db, colPath),
        where("isActive", "==", true),
        orderBy(primarySortField, "desc"),
        // orderBy("createdAt", "desc"),
        limit(FETCH_LIMIT),
      );

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          setDocs((prevDocs) => {
            const newDocs = { ...prevDocs };
            let changed = false;
            snapshot.docChanges().forEach((change) => {
              const docData = {
                id: change.doc.id,
                entryType: entryType,
                ...change.doc.data(),
              } as DBentry;
              if (change.type === "added" || change.type === "modified") {
                if (
                  JSON.stringify(newDocs[change.doc.id]) !==
                  JSON.stringify(docData)
                ) {
                  // Basic change check
                  newDocs[change.doc.id] = docData;
                  changed = true;
                  console.log(
                    `Doc ${change.type}: ${change.doc.id} in ${subcollectionName}`,
                  );
                }
              } else if (change.type === "removed") {
                if (newDocs[change.doc.id]) {
                  delete newDocs[change.doc.id];
                  changed = true;
                  console.log(
                    `Doc removed: ${change.doc.id} from ${subcollectionName}`,
                  );
                }
              }
            });
            return changed ? newDocs : prevDocs; // Only update state if changes occurred
          });
        },
        (error) => {
          // Add error handler for onSnapshot
          console.error(`Error watching collection ${colPath}: `, error);
          // Optionally set an error state here
        },
      );
    } catch (error) {
      console.error(`useEntriesSubCol (${entryType}): setup error`, error);
    }

    // Cleanup function
    return () => {
      console.log(
        `Unsubscribing from ${entryType} entries for journal ${journalId}`,
      );
      unsubscribe();
    };
  }, [journalId, entryType]); // Re-run effect if journalId or entryType changes

  return docs;
}

// --- useWatchJournal ---
// Path updated to JOURNAL_COLLECTION
export function useWatchJournal(journalId: string | null) {
  // Allow null journalId
  const [journal, setJournal] = useState<Journal | undefined | null>(
    undefined,
  ); // Allow null for not found
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setJournal(undefined); // Reset on ID change
    setLoading(true);

    if (!journalId) {
      setLoading(false);
      setJournal(null); // Set to null if no ID
      return () => {}; // Return empty cleanup
    }

    console.log("Watching journal: ", journalId);
    const docRef = doc(db, JOURNAL_COLLECTION, journalId); // Use JOURNAL_COLLECTION

    const unsubscribe = onSnapshot(
      docRef,
      (doc) => {
        if (doc.exists()) {
          setJournal({ id: doc.id, ...doc.data() } as Journal); // Use updated Journal type
        } else {
          console.warn(`Journal ${journalId} not found.`);
          setJournal(null); // Set to null if not found
        }
        setLoading(false);
      },
      (error) => {
        // Add error handler
        console.error(`Error watching journal ${journalId}: `, error);
        setJournal(null);
        setLoading(false);
        // Optionally set an error state
      },
    );

    return () => {
      console.log(`Unsubscribing from journal ${journalId}`);
      unsubscribe();
    };
  }, [journalId]); // Depend on journalId

  return { journal, loading };
}

// Doc type might be redundant now with Journal type
// export interface Doc extends DocumentData {
//   id: string;
// }

// --- fetchJournals ---
// Query simplified, filtering by type happens client-side if needed
export async function fetchJournals(userID: string): Promise<Journal[]> {
  // Return Journal[]
  console.log("Fetching journals for user ", userID);
  try {
    const q = query(
      collection(db, JOURNAL_COLLECTION), // Use JOURNAL_COLLECTION
      where("isActive", "==", true),
      where("access_array", "array-contains", userID),
      orderBy("createdAt", "desc"), // Optional: order by creation date
    );

    const querySnapshot = await getDocs(q);
    const journals: Journal[] = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as any), // Cast needed
    }));

    console.log("Journals fetched:", journals.length);
    return journals;
  } catch (error) {
    console.error("Error fetching journals:", error);
    return [];
  }
}

// --- fetchEntry ---
// Now requires entryType
export async function fetchEntry(
  journalId: string,
  entryType: EntryType, // --- ADD entryType ---
  entryId: string,
): Promise<DBentry | null> {
  // Return type updated
  const config = getEntryConfig(entryType);
  if (!config) return null;
  const subcollectionName = config.subcollection;

  try {
    const docPath = `${JOURNAL_COLLECTION}/${journalId}/${subcollectionName}/${entryId}`;
    console.info(`Getting DocPath ${docPath}`);
    const docRef = doc(db, docPath);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        entryType: entryType, // Add entryType
        ...(docSnap.data() as any),
      } as DBentry;
    } else {
      console.log(`No such entry document: ${docPath}`);
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
  // Return Journal | null
  try {
    console.log("Fetching journal ", journalId);
    const docRef = doc(db, JOURNAL_COLLECTION, journalId); // Use JOURNAL_COLLECTION
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Journal; // Use updated Journal type
    } else {
      console.log(`No such journal document: ${journalId}`);
      return null;
    }
  } catch (error) {
    console.error(`Error getting journal document: ${journalId}`, error);
    return null;
  }
}
