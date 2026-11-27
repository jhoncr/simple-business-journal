// frontend/src/context/JournalContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { useSearchParams } from "next/navigation"; // To get journalId
import { useWatchJournal } from "@/lib/db_handler";
import { Journal } from "@/lib/custom_types"; // Assuming Journal type exists
import { useTranslations } from "next-intl";

interface JournalContextProps {
  journal: Journal | null | undefined; // undefined while loading, null if not found
  loading: boolean;
  error: string | null; // Add basic error state
  jtype: string | null; // Current view type (estimate, template, etc.)
}

const JournalContext = createContext<JournalContextProps>({
  journal: undefined,
  loading: true,
  error: null,
  jtype: null,
});

export const useJournalContext = () => useContext(JournalContext);

interface JournalProviderProps {
  children: ReactNode;
}

export const JournalProvider: React.FC<JournalProviderProps> = ({
  children,
}) => {
  const t = useTranslations("entryPage");
  const searchParams = useSearchParams();
  const journalId = searchParams.get("jid"); // Read journalId from URL
  const jtype = searchParams.get("jtype"); // Read jtype from URL
  const { journal: watchedJournal, loading: watchLoading } =
    useWatchJournal(journalId);
  const [error, setError] = useState<string | null>(null);

  // Basic error handling: if loading finished and no journal found
  useEffect(() => {
    if (!watchLoading && !watchedJournal && journalId) {
      setError(t("journalNotFoundOrDenied"));
    } else {
      setError(null); // Clear error if journal is found or loading
    }
  }, [watchLoading, watchedJournal, journalId, t]);

  const value = useMemo(
    () => ({
      journal: watchedJournal,
      loading: watchLoading,
      error,
      jtype,
    }),
    [watchedJournal, watchLoading, error, jtype],
  );

  return (
    <JournalContext.Provider value={value}>{children}</JournalContext.Provider>
  );
};
