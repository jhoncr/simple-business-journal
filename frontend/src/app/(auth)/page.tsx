"use client";
import { CreateNewJournal } from "@/app/(auth)/journal/journal-types/create-new-journal";
import { fetchJournals } from "@/lib/db_handler";
import { Journal } from "@/lib/custom_types";
import { useAuth } from "@/lib/auth_handler";
import { useToolbar } from "./nav_tool_handler";
import { useCallback, useEffect, useState } from "react";
import { JournalInfoCard } from "@/components/ui/journal-info-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { FolderOpen } from "lucide-react";
import { JOURNAL_TYPES } from "@backend/common/const";
import { ENTRY_CONFIG } from "@backend/common/schemas/configmap";
import { BusinessDetailsType } from "@backend/common/schemas/JournalSchema";
import { useTranslations } from "next-intl";
import { useToast } from "@/hooks/use-toast";

function DisplayJournalList({
  journals,
  onJournalChanged,
}: {
  journals: Journal[];
  onJournalChanged: () => void;
}) {
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
          onSuccess={onJournalChanged}
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
          onSuccess={onJournalChanged}
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
            const details = journal.details as BusinessDetailsType | undefined;
            const isAdmin = Boolean(
              authUser?.uid && journal.access?.[authUser.uid]?.role === "admin",
            );
            cardProps = {
              id: journal.id,
              currency: details?.currency || "USD",
              contactInfo: details?.contactInfo || {
                name: journal.title,
                address: {},
              },
              logo: details?.logo || null,
              isAdmin,
              onChanged: onJournalChanged,
              journalSubcollections: Object.entries(ENTRY_CONFIG)
                .filter(([_, config]) => config.category === "business")
                .reduce((acc, [key, config]) => {
                  acc[key] = { subcollection: config.subcollection };
                  return acc;
                }, {} as Record<string, { subcollection: string }>),
            };
          } else {
            console.warn(
              "Unsupported journal type for display:",
              journal.journalType,
            );
            return null;
          }

          return (
            <div key={journal.id} className="w-full sm:w-[320px] shrink-0">
              <JournalInfoCard {...cardProps} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Home() {
  const t = useTranslations();
  const { setToolBar } = useToolbar();
  const { toast } = useToast();
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { authUser } = useAuth();

  const loadJournals = useCallback(async () => {
    if (!authUser?.uid) {
      setJournals([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const fetchedJournals = await fetchJournals(authUser.uid);
      setJournals(fetchedJournals);
    } catch (err: unknown) {
      console.error("Error loading journals:", err);
      const message =
        err instanceof Error && err.message
          ? err.message
          : t("errors.loadJournals");
      setError(message);
      toast({
        title: t("common.error"),
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [authUser, t, toast]);

  useEffect(() => {
    loadJournals();
  }, [loadJournals]);

  useEffect(() => {
    setToolBar(
      <h1 className="text-lg font-bold">{t("navigation.dashboard")}</h1>,
    );
    return () => setToolBar(null);
  }, [setToolBar, t]);

  return (
    <div className="flex flex-col items-center justify-start min-h-screen py-4 md:py-6">
      <div className="flex flex-col items-center justify-start w-full max-w-6xl mx-auto flex-1 px-4 md:px-6 lg:px-8 text-center">
        {loading && (
          <div className="w-full flex flex-wrap gap-4 justify-center md:justify-start mt-4">
            <Skeleton className="w-full sm:w-[320px] max-w-full h-[200px] rounded-lg shrink-0" />
            <Skeleton className="w-full sm:w-[320px] max-w-full h-[200px] rounded-lg shrink-0 hidden sm:block" />
            <Skeleton className="w-full sm:w-[320px] max-w-full h-[200px] rounded-lg shrink-0 hidden md:block" />
            <Skeleton className="w-full sm:w-[320px] max-w-full h-[200px] rounded-lg shrink-0 hidden lg:block" />
          </div>
        )}
        {error && (
          <div className="mt-8 flex flex-col items-center gap-3">
            <p className="text-destructive">
              {t("common.error")}: {error}
            </p>
            <Button variant="outline" size="sm" onClick={loadJournals}>
              {t("common.retry")}
            </Button>
          </div>
        )}
        {!loading && !error && (
          <DisplayJournalList
            journals={journals}
            onJournalChanged={loadJournals}
          />
        )}
      </div>
    </div>
  );
}
