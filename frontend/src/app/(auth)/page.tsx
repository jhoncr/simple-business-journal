"use client";
import Link from "next/link";
import { CreateNewJournal } from "@/app/(auth)/journal/journal-types/create-new-journal"; // This should be the refactored one
// --- Remove Card imports if JournalInfoCard is used ---
// import { Card, CardContent } from "@/components/ui/card";
// import { formattedDate } from "@/lib/utils";
// --- Update db_handler import and types ---
import { fetchJournals } from "@/lib/db_handler";
import { Journal } from "@/lib/custom_types"; // Use the updated Journal type
import { useAuth } from "@/lib/auth_handler";
// --- Remove getJournalIcon if not used directly here ---
// import { getJournalIcon } from "./journal/journal-types/config";
import { useToolbar } from "./nav_tool_handler";
import { useEffect, useState } from "react";
import { JournalInfoCard } from "@/components/ui/journal-info-card"; // Import the card
// --- Import Constants ---
import { JOURNAL_TYPES } from "@/../../backend/functions/src/common/const";
import { ENTRY_CONFIG } from "@/../../backend/functions/src/common/schemas/configmap"; // Import entry config
import { BusinessDetailsType } from "@/../../backend/functions/src/common/schemas/JournalSchema"; // Import details type

// --- Renamed Component: DisplayJournalList ---
// Renders the list of journals using JournalInfoCard
function DisplayJournalList({ journals }: { journals: Journal[] }) {
  if (journals.length === 0) {
    return (
      <p className="text-muted-foreground mt-4">
        No journals found. Create a new business to get started!
      </p>
    );
  }

  return (
    <div className="w-full flex flex-wrap gap-4 justify-center md:justify-start">
      {" "}
      {/* Use justify-center on small screens */}
      {journals.map((journal) => {
        // --- Extract props for JournalInfoCard ---
        // Handle different journal types for extracting details
        let cardProps: any = { id: journal.id };

        if (journal.journalType === JOURNAL_TYPES.BUSINESS) {
          const details = journal.details as BusinessDetailsType | undefined; // Cast safely
          cardProps = {
            ...cardProps,
            currency: details?.currency || "USD", // Default currency
            contactInfo: details?.contactInfo || {
              name: journal.title,
              address: {},
            },
            logo: details?.logo || null,
            // --- Pass Subcollection Info (example: map config) ---
            // get only config where entry.category="business"
            journalSubcollections: Object.entries(ENTRY_CONFIG)
              .filter(([key, config]) => config.category === "business")
              .reduce((acc, [key, config]) => {
                acc[key] = config;
                return acc;
              }, {} as Record<string, any>),
          };
        } else if (journal.journalType === JOURNAL_TYPES.BABY) {
          // --- Handle Baby Journal Type ---
          // You'll need a specific BabyInfoCard or adapt JournalInfoCard
          // For now, use JournalInfoCard with baby-specific details extraction
          const details = journal.details as any; // Replace 'any' with BabyDetailsType later
          cardProps = {
            ...cardProps,
            // No currency for baby?
            contactInfo: { name: journal.title, address: {} }, // Just use title as name
            logo: null, // No logo for baby?
            journalSubcollections: Object.entries(ENTRY_CONFIG)
              .filter(([_, config]) => config.category === "baby")
              .map(([key, config]) => ({ key, ...config })),
          };
          // Consider a different Card component for Baby type
          // return <BabyInfoCard key={journal.id} {...babyProps} />;
        } else {
          // Handle other types or skip rendering
          console.warn(
            "Unsupported journal type for display:",
            journal.journalType,
          );
          return null; // Don't render unsupported types
        }

        return (
          // --- Render JournalInfoCard ---
          // Ensure JournalInfoCard props match what's passed
          <JournalInfoCard key={journal.id} {...cardProps} />
        );
      })}
    </div>
  );
}

// --- Main Page Component ---
export default function Home() {
  const { setToolBar } = useToolbar();
  // --- Simplified State: Just one list of journals ---
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true); // Add loading state
  const [error, setError] = useState<string | null>(null); // Add error state
  const { authUser } = useAuth();

  // --- Fetch Journals Effect ---
  useEffect(() => {
    const loadJournals = async () => {
      if (!authUser?.uid) {
        setJournals([]); // Clear journals if no user
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        // Use the refactored fetchJournals
        const fetchedJournals = await fetchJournals(authUser.uid);
        // No need to filter by group type anymore
        setJournals(fetchedJournals);
      } catch (err: any) {
        console.error("Error loading journals:", err);
        setError(err.message || "Failed to load journals.");
      } finally {
        setLoading(false);
      }
    };
    loadJournals();
  }, [authUser]); // Depend only on authUser

  // --- Toolbar Effect ---
  useEffect(() => {
    // Update toolbar title based on context (e.g., "My Journals", "Dashboard")
    setToolBar(<h1 className="text-lg font-bold">Dashboard</h1>);
    // Cleanup function
    return () => setToolBar(null);
  }, [setToolBar]); // Depend on setToolBar

  return (
    <div className="flex flex-col items-center justify-start min-h-screen py-4 md:py-6">
      {" "}
      {/* Adjusted padding */}
      <div className="flex flex-col items-center justify-start w-full max-w-6xl mx-auto flex-1 px-4 md:px-6 lg:px-8 text-center">
        {" "}
        {/* Use max-w-6xl */}
        {/* --- Loading and Error States --- */}
        {loading && (
          <p className="text-muted-foreground mt-8">Loading journals...</p>
        )}
        {error && <p className="text-destructive mt-8">Error: {error}</p>}
        {/* --- Display Journal List --- */}
        {!loading && !error && <DisplayJournalList journals={journals} />}
        {/* --- Create New Button (should be the refactored version) --- */}
        {/* Positioned at bottom right or similar */}
        <div className="mt-auto pt-10">
          {" "}
          {/* Push to bottom */}
          <CreateNewJournal />
        </div>
      </div>
    </div>
  );
}
