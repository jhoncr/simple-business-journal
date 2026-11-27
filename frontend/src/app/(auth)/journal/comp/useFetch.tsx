import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { fetchOlderEntrys, useEntriesSubCol } from "@/lib/db_handler";
import { DBentry, DBentryMap } from "@/lib/custom_types";
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
  const prevRealtimeKeysRef = useRef<Set<string>>(new Set());

  // Merge realtime entries into allEntries.
  // Only prune a key leaving the realtime window if it was actually removed (i.e. window is not full,
  // or the removed entry's sort timestamp is strictly newer than the oldest entry in the current window).
  // Entries pushed past the limit(20) boundary by newer additions remain preserved in allEntries.
  useEffect(() => {
    const currentRealtimeKeys = new Set(Object.keys(realtimeEntries));
    const prevRealtimeKeys = prevRealtimeKeysRef.current;

    const currentSorted = sortEntries(realtimeEntries, entryType);
    const windowIsFull = currentRealtimeKeys.size >= FETCH_LIMIT;
    const oldestInWindowMs =
      currentSorted.length > 0
        ? getSortableDate(currentSorted[currentSorted.length - 1], entryType)
        : 0;

    setAllEntries((prev) => {
      const updated = { ...prev, ...realtimeEntries };
      for (const key of prevRealtimeKeys) {
        if (!currentRealtimeKeys.has(key)) {
          const prevEntry = prev[key];
          if (!windowIsFull) {
            delete updated[key];
          } else if (
            prevEntry &&
            getSortableDate(prevEntry, entryType) > oldestInWindowMs
          ) {
            delete updated[key];
          }
        }
      }
      return updated;
    });

    prevRealtimeKeysRef.current = currentRealtimeKeys;
  }, [realtimeEntries, entryType]);

  // Memoized sorted list
  const sortedEntries = useMemo(() => {
    return sortEntries(allEntries, entryType);
  }, [allEntries, entryType]);

  // Expose loading state
  const loading = paginationState === "fetching";
  const hasMore = paginationState !== "complete";

  // Fetch function that can be called externally
  const fetchMore = useCallback(async () => {
    if (isFetchingRef.current || paginationState === "complete") {
      return;
    }

    const currentEntries = sortEntries(allEntries, entryType);
    if (currentEntries.length === 0) {
      return;
    }

    const oldestEntry = currentEntries[currentEntries.length - 1];

    // Prevent fetching same batch twice
    if (lastCursorRef.current === oldestEntry.id) {
      return;
    }

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

      if (fetchedCount === 0) {
        setPaginationState("complete");
      } else {
        setAllEntries((prev) => ({ ...prev, ...olderEntries }));
        setPaginationState("idle");
        lastCursorRef.current = oldestEntry.id;
      }
    } catch (err: unknown) {
      console.error(`[${entryType}] Error fetching older entries:`, err);
      const message =
        err instanceof Error ? err.message : "Failed to load older entries";
      setError(message);
      setPaginationState("error");
    } finally {
      isFetchingRef.current = false;
    }
  }, [journalId, entryType, allEntries, paginationState]);

  // Remove entry from local state
  const removeEntry = useCallback((entryToRemove: DBentry) => {
    setAllEntries((prev) => {
      const newEntries = { ...prev };
      delete newEntries[entryToRemove.id];
      return newEntries;
    });
  }, []);

  // Reset state when journal or entry type changes
  useEffect(() => {
    setAllEntries({});
    setPaginationState("idle");
    setError(null);
    lastCursorRef.current = null;
    isFetchingRef.current = false;
    prevRealtimeKeysRef.current = new Set();
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
