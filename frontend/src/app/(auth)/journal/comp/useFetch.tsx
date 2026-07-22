import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { fetchOlderEntrys, useEntriesSubCol } from "@/lib/db_handler";
import { DBentry, DBentryMap } from "../../../../lib/custom_types";
import { EntryType } from "@backend/common/schemas/configmap";
import { ENTRY_CONFIG } from "@/lib/config_shared";

const FETCH_LIMIT = 20;

// Define pagination states
type PaginationState = "idle" | "fetching" | "complete" | "error";

// Helper to get sortable date from entry based on ENTRY_CONFIG
const getSortableDate = (entry: DBentry, entryType: EntryType): number => {
  const config = ENTRY_CONFIG[entryType];
  const sortField = config?.sortField || "createdAt";

  if (sortField.startsWith("details.")) {
    const field = sortField.split(".")[1];
    const value = (entry.details as any)?.[field];
    if (value && typeof value.toMillis === "function") {
      return value.toMillis();
    }
  }

  // Fallback to createdAt
  return entry.createdAt?.toMillis() ?? 0;
};

// Sorting function aligned with backend query order
const sortEntries = (entries: DBentryMap, entryType: EntryType): DBentry[] => {
  return Object.values(entries)
    .filter((entry) => entry && entry.createdAt)
    .sort((a, b) => {
      const dateA = getSortableDate(a, entryType);
      const dateB = getSortableDate(b, entryType);

      if (dateA !== dateB) {
        return dateB - dateA; // Descending order (newest first)
      }

      // Secondary sort by createdAt
      const createdAtA = a.createdAt?.toMillis() ?? 0;
      const createdAtB = b.createdAt?.toMillis() ?? 0;
      return createdAtB - createdAtA;
    });
};

export function useFetchEntries(journalId: string, entryType: EntryType) {
  const [paginationState, setPaginationState] =
    useState<PaginationState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [allEntries, setAllEntries] = useState<DBentryMap>({});

  // Track the last entry ID we fetched from to prevent duplicate fetches
  const lastCursorRef = useRef<string | null>(null);
  const isFetchingRef = useRef(false);

  // Watch latest entries
  const realtimeEntries = useEntriesSubCol(journalId, entryType);

  // Merge realtime entries into allEntries
  useEffect(() => {
    setAllEntries((prev) => ({ ...prev, ...realtimeEntries }));
  }, [realtimeEntries]);

  // Memoized sorted list
  const sortedEntries = useMemo(() => {
    return sortEntries(allEntries, entryType);
  }, [allEntries, entryType]);

  // Expose loading state
  const loading = paginationState === "fetching";
  const hasMore = paginationState !== "complete";

  // Fetch function that can be called externally
  const fetchMore = useCallback(async () => {
    // Guard clauses
    if (isFetchingRef.current) {
      console.log(`[${entryType}] Already fetching, skipping`);
      return;
    }

    if (paginationState === "complete") {
      console.log(`[${entryType}] No more entries to fetch`);
      return;
    }

    const currentEntries = sortEntries(allEntries, entryType);
    if (currentEntries.length === 0) {
      console.log(`[${entryType}] No entries yet to paginate from`);
      return;
    }

    const oldestEntry = currentEntries[currentEntries.length - 1];

    // Prevent fetching same batch twice
    if (lastCursorRef.current === oldestEntry.id) {
      console.log(
        `[${entryType}] Already fetched from cursor ${oldestEntry.id}`,
      );
      return;
    }

    console.log(
      `[${entryType}] Fetching older entries from ${oldestEntry.id}`,
    );

    isFetchingRef.current = true;
    setPaginationState("fetching");
    setError(null);

    try {
      const olderEntries = await fetchOlderEntrys(
        journalId,
        entryType,
        oldestEntry,
        FETCH_LIMIT,
      );

      const fetchedCount = Object.keys(olderEntries).length;
      console.log(`[${entryType}] Fetched ${fetchedCount} older entries`);

      if (fetchedCount === 0) {
        setPaginationState("complete");
      } else {
        setAllEntries((prev) => ({ ...prev, ...olderEntries }));
        setPaginationState("idle");
        lastCursorRef.current = oldestEntry.id;
      }
    } catch (err: any) {
      console.error(`[${entryType}] Error fetching older entries:`, err);
      setError(err.message || "Failed to load older entries");
      setPaginationState("error");
      // Don't update cursor on error to allow retry
    } finally {
      isFetchingRef.current = false;
    }
  }, [journalId, entryType, allEntries, paginationState]);

  // Remove entry from local state
  const removeEntry = useCallback((entryToRemove: DBentry) => {
    console.log(`Removing entry ${entryToRemove.id} from local state`);
    setAllEntries((prev) => {
      const newEntries = { ...prev };
      delete newEntries[entryToRemove.id];
      return newEntries;
    });
  }, []);

  // Reset state when journal or entry type changes
  useEffect(() => {
    console.log(`[${entryType}] Resetting state for journal ${journalId}`);
    setAllEntries({});
    setPaginationState("idle");
    setError(null);
    lastCursorRef.current = null;
    isFetchingRef.current = false;
  }, [journalId, entryType]);

  return {
    list: sortedEntries,
    loading,
    error,
    hasMore,
    fetchMore,
    removeEntry,
  };
}
