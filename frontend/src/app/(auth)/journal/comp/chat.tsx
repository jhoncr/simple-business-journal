import React, { useState, useEffect, useCallback, memo, useRef } from "react";
import { DBentry } from "../../../../lib/custom_types";
import { AccessMap } from "@/../../backend/functions/src/common/schemas/common_schemas";
import { Button } from "@/components/ui/button";
import { ChevronsUp } from "lucide-react";
import { Entry } from "./Entry";
import { useFetchEntries } from "./useFetch";
import { useAuth } from "@/lib/auth_handler";
import { useTranslations } from "next-intl";
import { useToast } from "@/hooks/use-toast";
import { EntryType } from "@/../../backend/functions/src/common/schemas/configmap";

interface MessageListProps {
  messages: DBentry[];
  journalId: string;
  entryType: EntryType;
  access: AccessMap;
  loading: boolean;
  error?: string | null;
  hasMore: boolean;
  role: string;
  onLoadMore: () => void;
  removeFn: (entry: DBentry) => void;
  onDuplicated?: (newEntryId: string) => void;
}

const MessageList = memo(function MessageList({
  messages,
  journalId,
  entryType,
  access,
  loading,
  error,
  hasMore,
  role,
  onLoadMore,
  removeFn,
  onDuplicated,
}: MessageListProps) {
  const [showToTopButton, setShowToTopButton] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);

  // Set up Intersection Observer for bottom detection
  useEffect(() => {
    if (!bottomSentinelRef.current || !scrollRef.current) return;

    // Clean up previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Create new observer with explicit root
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !loading) {
          console.log("[MessageList] Bottom sentinel visible, loading more");
          onLoadMore();
        }
      },
      {
        root: scrollRef.current, // Explicitly set the scroll container as root
        rootMargin: "200px", // Trigger 200px before reaching bottom for smoother UX
        threshold: 0,
      },
    );

    observerRef.current.observe(bottomSentinelRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loading, onLoadMore]);

  // Simple scroll handler for "back to top" button
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop } = event.currentTarget;
    setShowToTopButton(scrollTop > 100);
  }, []);

  const scrollToTop = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  }, []);

  const LoadingIndicator = () => {
    const t = useTranslations("journal");
    return (
      <div className="w-full py-4">
        {error ? (
          <p className="text-center text-sm text-red-500">{error}</p>
        ) : loading ? (
          <p className="text-center text-sm text-muted-foreground">
            {t("loading")}
          </p>
        ) : !hasMore ? (
          <p className="text-center text-sm text-muted-foreground">
            {t("noMoreEntries")}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <div className="w-full h-full relative overflow-hidden">
      {/* Back to top button */}
      <Button
        className={`h-14 w-14 rounded-full transform -translate-x-1/2 z-50 absolute top-10 left-1/2 transition-opacity duration-200 ${
          showToTopButton ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        variant="outline"
        onClick={scrollToTop}
        aria-label="Scroll to top"
      >
        <ChevronsUp />
      </Button>

      {/* Scrollable message list */}
      <div
        className="w-full h-full flex flex-col overflow-y-auto overflow-x-hidden space-y-2 px-2"
        ref={scrollRef}
        onScroll={handleScroll}
      >
        {messages.map((entry: DBentry) => {
          const creatorInfo = access[entry.createdBy];
          if (!creatorInfo) {
            console.warn(
              `Creator info missing for user ID: ${entry.createdBy} on entry ${entry.id}`,
            );
          }

          const userProps = creatorInfo
            ? { ...creatorInfo, uid: entry.createdBy }
            : {
                uid: entry.createdBy,
                displayName: "Unknown User",
                email: "",
                role: "viewer" as const,
              };

          return entry?.createdBy ? (
            <Entry
              key={entry.id}
              journalId={journalId}
              entryType={entryType}
              entry={entry}
              user={userProps}
              removeFn={removeFn}
              role={role}
              onDuplicated={onDuplicated}
            />
          ) : null;
        })}

        {/* Loading indicator */}
        <LoadingIndicator />

        {/* Bottom sentinel for Intersection Observer */}
        <div ref={bottomSentinelRef} className="h-1 w-full" />
      </div>
    </div>
  );
});

interface ChatBoxProps {
  journalId: string;
  entryType: EntryType;
  access: AccessMap;
  actionButton: React.ReactNode;
  filterList: DBentry[];
  hasFilter: boolean;
  removeFilterEntry: (entry: DBentry) => void;
  onDuplicated?: (newEntryId: string) => void;
}

export function ChatBox({
  journalId,
  entryType,
  access,
  actionButton,
  filterList,
  hasFilter,
  removeFilterEntry,
  onDuplicated,
}: ChatBoxProps) {
  const { loading, error, list, hasMore, fetchMore, removeEntry } =
    useFetchEntries(journalId, entryType);
  const { authUser } = useAuth();
  const viewerRole = (authUser && access[authUser.uid]?.role) || "viewer";
  const { toast } = useToast();
  const t = useTranslations("journal");

  // Display error toast when fetch fails
  useEffect(() => {
    if (error) {
      toast({
        title: t("error") || "Error",
        description: error,
        variant: "destructive",
      });
    }
  }, [error, toast, t]);

  return (
    <div className="relative flex flex-col space-y-1 md:max-w-2xl w-full mx-auto h-full overflow-hidden">
      {authUser && (
        <MessageList
          messages={hasFilter ? filterList : list}
          journalId={journalId}
          entryType={entryType}
          access={access}
          loading={loading}
          error={error}
          hasMore={hasMore}
          role={viewerRole}
          onLoadMore={fetchMore}
          removeFn={hasFilter ? removeFilterEntry : removeEntry}
          onDuplicated={onDuplicated}
        />
      )}
      <div
        id="action-btn"
        className="fixed bottom-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-content h-content z-40"
      >
        {actionButton}
      </div>
    </div>
  );
}
