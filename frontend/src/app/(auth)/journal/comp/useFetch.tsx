import { useState, useEffect, useCallback } from "react";
import { fetchOlderEntrys, useEntriesSubCol } from "@/lib/db_handler"; // These should now accept entryType
import { DBentry, DBentryMap } from "../../../../lib/custom_types"; // Types remain the same
import { EntryType } from "@/../../backend/functions/src/common/schemas/configmap"; // Import EntryType

const FETCH_LIMIT = 20; // Items per page

// --- Sorting Function ---
// This function seems okay, it prioritizes details.date if available,
// otherwise falls back to createdAt. Ensure the relevant 'date' field
// (e.g., details.date, details.time, details.start) exists for sorting.
// The sortField is defined in FE_ENTRY_CONFIG in db_handler.tsx now.
// Let's make this sort more robust based on potential date fields.
const sortEntries = (entries: DBentryMap): DBentry[] => {
  const getSortableDate = (entry: DBentry): number => {
    // Prioritize common date fields in details
    const detailsDate =
      entry.details?.date || entry.details?.time || entry.details?.start;
    if (detailsDate && typeof detailsDate.toMillis === "function") {
      return detailsDate.toMillis();
    }
    // Fallback to createdAt
    return entry.createdAt?.toMillis() ?? 0;
  };

  const sortedEntries = Object.values(entries)
    // Filter out entries without necessary data for sorting (optional but safer)
    .filter((entry) => entry && entry.createdAt)
    .sort((a, b) => {
      const dateA = getSortableDate(a);
      const dateB = getSortableDate(b);

      // Primary sort: Date (descending)
      if (dateA !== dateB) {
        return dateB - dateA; // Newer dates first
      }

      // Secondary sort: Creation time (descending) for same date
      const createdAtA = a.createdAt?.toMillis() ?? 0;
      const createdAtB = b.createdAt?.toMillis() ?? 0;
      return createdAtB - createdAtA; // Newer creation times first
    });
  return sortedEntries;
};

// --- Update Hook Signature ---
export function useFetchEntries(
  journalId: string,
  entryType: EntryType, // --- ADD entryType ---
  page: number = 0,
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null); // Add error state
  const [list, setList] = useState<DBentry[]>([]); // Store sorted array
  const [hasMore, setHasMore] = useState(true); // Track if more pages exist
  const [combinedDocs, setCombinedDocs] = useState<DBentryMap>({}); // Store all fetched docs

  // --- Watch latest entries using the updated hook ---
  // useEntriesSubCol now takes entryType
  const headDocs = useEntriesSubCol(journalId, entryType);

  // --- Update combinedDocs whenever headDocs changes ---
  useEffect(() => {
    setCombinedDocs((prevDocs) => ({ ...prevDocs, ...headDocs }));
  }, [headDocs]);

  // --- Fetch Older Entries Function ---
  const fetchOlder = useCallback(async () => {
    // Prevent fetching if already loading or no more entries exist
    if (loading || !hasMore || list.length === 0) {
      if (!hasMore)
        console.log(`fetchOlder (${entryType}): No more entries to fetch.`);
      return;
    }

    console.log(`<<< Fetching older ${entryType} messages (Page ${page}) >>>`);
    setLoading(true);
    setError(null);

    const oldestEntryInList = list[list.length - 1]; // Get the actual oldest entry currently displayed

    try {
      // --- Call fetchOlderEntrys with entryType ---
      const fetchedMessages = await fetchOlderEntrys(
        journalId,
        entryType, // Pass entryType
        oldestEntryInList,
        FETCH_LIMIT,
      );

      const numFetched = Object.keys(fetchedMessages).length;
      console.log(`Fetched ${numFetched} older ${entryType} entries.`);

      if (numFetched === 0) {
        setHasMore(false); // No more entries found
      } else {
        // Merge fetched messages into combinedDocs
        setCombinedDocs((prevDocs) => ({ ...prevDocs, ...fetchedMessages }));
      }
    } catch (err: any) {
      console.error(`Error fetching older ${entryType} entries:`, err);
      setError(err.message || `Failed to load older ${entryType} entries.`);
      // Optionally stop trying to fetch more on error?
      // setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [journalId, entryType, page, list, loading, hasMore]); // Add dependencies

  // --- Effect to trigger fetchOlder when page changes ---
  useEffect(() => {
    // Only fetch older if page > 0 (initial load is handled by headDocs)
    if (page > 0) {
      console.log(
        `Paging changed for ${entryType} to ${page}, fetching older.`,
      );
      fetchOlder();
    }
    // Reset hasMore when switching journal/type (page goes back to 0)
    if (page === 0) {
      setHasMore(true);
    }
  }, [page, fetchOlder, entryType]); // Depend on page and fetchOlder

  // --- Effect to sort and update the final list ---
  useEffect(() => {
    console.log(
      `Sorting ${Object.keys(combinedDocs).length} combined ${entryType} docs`,
    );
    const sortedList = sortEntries(combinedDocs);
    setList(sortedList);
    // console.log(`Updated list for ${entryType}:`, sortedList.length, "items");
  }, [combinedDocs, entryType]); // Depend on combinedDocs

  // --- Remove Entry Function ---
  // This function removes an entry from the local state
  const removeEntry = useCallback(
    (entryToRemove: DBentry) => {
      console.log(
        `Removing entry ${entryToRemove.id} (${entryType}) from local state.`,
      );
      setCombinedDocs((prevDocs) => {
        const newDocs = { ...prevDocs };
        if (newDocs[entryToRemove.id]) {
          delete newDocs[entryToRemove.id];
          return newDocs;
        }
        return prevDocs; // No change if not found
      });
      // The list state will update automatically via the useEffect watching combinedDocs
    },
    [entryType],
  ); // Depend on entryType for logging consistency

  return { loading, error, list, hasMore, removeEntry }; // Return error and hasMore
}
