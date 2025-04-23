// frontend/src/context/JournalContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useSearchParams } from "next/navigation"; // To get journalId
import { useWatchJournal } from "@/lib/db_handler";
import { Journal } from "@/lib/custom_types"; // Assuming Journal type exists

interface JournalContextProps {
  journal: Journal | null | undefined; // undefined while loading, null if not found
  loading: boolean;
  error: string | null; // Add basic error state
}

const JournalContext = createContext<JournalContextProps>({
  journal: undefined,
  loading: true,
  error: null,
});

export const useJournalContext = () => useContext(JournalContext);

interface JournalProviderProps {
  children: ReactNode;
  // Pass journalId explicitly if preferred over reading from params here
  // journalId: string | null;
}

export const JournalProvider: React.FC<JournalProviderProps> = ({
  children,
}) => {
  const searchParams = useSearchParams();
  const journalId = searchParams.get("jid"); // Read journalId from URL
  const { journal: watchedJournal, loading: watchLoading } =
    useWatchJournal(journalId);
  const [error, setError] = useState<string | null>(null);

  // Basic error handling: if loading finished and no journal found
  useEffect(() => {
    if (!watchLoading && !watchedJournal && journalId) {
      setError("Journal not found or access denied.");
    } else {
      setError(null); // Clear error if journal is found or loading
    }
  }, [watchLoading, watchedJournal, journalId]);

  const value = {
    journal: watchedJournal,
    loading: watchLoading,
    error: error,
  };

  return (
    <JournalContext.Provider value={value}>{children}</JournalContext.Provider>
  );
};
