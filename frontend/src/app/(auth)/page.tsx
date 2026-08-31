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
import { JournalInfoCard } from "@/components/ui/journal-info-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { FolderOpen } from "lucide-react";
// --- Import Constants ---
import { JOURNAL_TYPES } from "@backend/common/const";
import { ENTRY_CONFIG } from "@backend/common/schemas/configmap"; // Import entry config
import { BusinessDetailsType } from "@backend/common/schemas/JournalSchema"; // Import details type
import { useTranslations } from "next-intl";

// --- Renamed Component: DisplayJournalList ---
// Renders the list of journals using JournalInfoCard
function DisplayJournalList({ journals }: { journals: Journal[] }) {
  const t = useTranslations("dashboard");
  const tNav = useTranslations("navigation");
  const { authUser } = useAuth();

  if (journals.length === 0) {
    return (
      <div className="w-full flex flex-col items-center justify-center p-12 mt-10 rounded-xl border border-dashed bg-muted/20 text-center animate-in fade-in zoom-in duration-500">
        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
          <FolderOpen className="w-10 h-10 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight mb-2">{t("noJournals")}</h2>
        <p className="text-muted-foreground max-w-sm mb-8">
          {t("emptyStateDesc")}
        </p>
        <CreateNewJournal 
          trigger={
            <Button size="lg" className="gap-2">
              <span className="text-lg">+</span> {tNav("newJournal")}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center md:items-start gap-4">
      <div className="w-full flex flex-wrap gap-4 justify-center md:justify-start">
        {/* The "Create New" Card */}
        <CreateNewJournal 
          trigger={
            <div className="flex flex-col gap-3 items-center justify-center w-full sm:w-[320px] max-w-full h-[200px] border-2 border-dashed rounded-lg hover:bg-muted/50 transition-colors cursor-pointer shrink-0">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-2xl text-primary">+</span>
              </div>
              <p className="font-semibold text-lg">{tNav("newJournal")}</p>
            </div>
          }
        />
        {journals.map((journal) => {
          let cardProps: React.ComponentProps<typeof JournalInfoCard>;

          if (journal.journalType === JOURNAL_TYPES.BUSINESS) {
            const details = journal.details as BusinessDetailsType | undefined; // Cast safely
            const isAdmin = Boolean(
              authUser?.uid && journal.access?.[authUser.uid]?.role === "admin",
            );
            cardProps = {
              id: journal.id,
              currency: details?.currency || "USD", // Default currency
              contactInfo: details?.contactInfo || {
                name: journal.title,
                address: {},
              },
              logo: details?.logo || null,
              isAdmin,
              journalSubcollections: Object.entries(ENTRY_CONFIG)
                .filter(([_, config]) => config.category === "business")
                .reduce((acc, [key, config]) => {
                  acc[key] = config as any;
                  return acc;
                }, {} as Record<string, any>),
            };
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
            <div key={journal.id} className="w-full sm:w-[320px] shrink-0">
              <JournalInfoCard {...cardProps} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Main Page Component ---
export default function Home() {
  const t = useTranslations();
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
    setToolBar(
      <h1 className="text-lg font-bold">{t("navigation.dashboard")}</h1>,
    );
    // Cleanup function
    return () => setToolBar(null);
  }, [setToolBar, t]); // Depend on setToolBar

  return (
    <div className="flex flex-col items-center justify-start min-h-screen py-4 md:py-6">
      {" "}
      {/* Adjusted padding */}
      <div className="flex flex-col items-center justify-start w-full max-w-6xl mx-auto flex-1 px-4 md:px-6 lg:px-8 text-center">
        {" "}
        {/* Use max-w-6xl */}
        {/* --- Loading and Error States --- */}
        {loading && (
           <div className="w-full flex flex-wrap gap-4 justify-center md:justify-start mt-4">
             <Skeleton className="w-full sm:w-[320px] max-w-full h-[200px] rounded-lg shrink-0" />
             <Skeleton className="w-full sm:w-[320px] max-w-full h-[200px] rounded-lg shrink-0 hidden sm:block" />
             <Skeleton className="w-full sm:w-[320px] max-w-full h-[200px] rounded-lg shrink-0 hidden md:block" />
             <Skeleton className="w-full sm:w-[320px] max-w-full h-[200px] rounded-lg shrink-0 hidden lg:block" />
           </div>
        )}
        {error && (
          <p className="text-destructive mt-8">
            {t("common.error")}: {error}
          </p>
        )}
        {/* --- Display Journal List --- */}
        {!loading && !error && <DisplayJournalList journals={journals} />}
      </div>
    </div>
  );
}
