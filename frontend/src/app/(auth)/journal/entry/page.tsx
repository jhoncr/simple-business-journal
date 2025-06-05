// frontend/src/app/(auth)/journal/entry/page.tsx
"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import { EstimateDetails } from "@/app/(auth)/journal/journal-types/estimate/addEstimate";
// --- Store import removed ---
// import { useJournalStore } from "@/lib/store/journalStore";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { useJournalContext } from "@/context/JournalContext"; // Import the context hook
import { JOURNAL_TYPES } from "@/../../backend/functions/src/common/const";
import { BusinessDetailsType } from "@/../../backend/functions/src/common/schemas/JournalSchema";
import { EntryItf } from "@/../../backend/functions/src/common/common_types";
import {
  contactInfoSchemaType,
  allowedCurrencySchemaType,
} from "@/../../backend/functions/src/common/schemas/common_schemas";

// Default empty contact info (useful for initialization)
const initInfo: contactInfoSchemaType = {
  name: "",
  email: null,
  phone: null,
  address: { street: null, city: null, state: null, zipCode: null },
};

// Component to render content - needed because hooks like useSearchParams
// need to be called within a Suspense boundary in the main export default function
function EditEstimateEntryPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const journalId = searchParams.get("jid");
  const entryId = searchParams.get("eid") || undefined; // Keep entryId optional

  // --- Use context state ---
  const {
    journal, // The loaded journal object (or null/undefined)
    loading: isJournalLoading, // Loading state from the context
    error: contextJournalError, // Error state from the context
  } = useJournalContext();

  // State for this page's specific validation error
  const [validationError, setValidationError] = useState<string | null>(null);

  // --- Effect 1: Validate IDs from URL ---
  useEffect(() => {
    setValidationError(null); // Reset validation error on ID change

    if (!journalId) {
      setValidationError("Journal ID (jid) is missing in the URL.");
      // Optionally redirect: router.replace('/');
      return;
    }

    // Basic validation for entryId format if present
    if (entryId && !/^[a-zA-Z0-9-_]{15,}$/.test(entryId)) {
      // Adjusted regex (example)
      setValidationError("Invalid entry ID (eid) format in the URL.");
      return;
    }

    // If validation passes, clear error
    setValidationError(null);
  }, [journalId, entryId, router]); // Rerun validation if IDs change

  // --- Prepare Props for EstimateDetails ---
  let supplierInfo: contactInfoSchemaType = initInfo;
  let supplierLogo: string | null = null;
  let journalCurrency: allowedCurrencySchemaType | undefined;
  let journalInventoryCache: Record<string, EntryItf> = {};

  if (journal && journal.journalType === JOURNAL_TYPES.BUSINESS) {
    const details = journal.details as BusinessDetailsType | undefined;
    supplierInfo = details?.contactInfo || initInfo;
    supplierLogo = details?.logo || null;
    journalCurrency = details?.currency;
    // Access inventory cache - might need 'any' cast or type update
    journalInventoryCache = (journal as any)?.inventoryCache || {};
  }

  // Combine validation and context errors
  const combinedError = validationError || contextJournalError;

  // --- Render Logic ---

  // Handle validation errors or context errors
  if (combinedError) {
    return (
      <div className="p-4 text-center text-destructive">
        <p>Error: {combinedError}</p>
        <Link href="/" className="text-primary underline mt-4 inline-block">
          Go Home
        </Link>
      </div>
    );
  }

  // Show loading skeleton while context is loading the journal
  if (isJournalLoading) {
    return (
      <div className="p-4 space-y-4 max-w-4xl mx-auto">
        <Skeleton className="h-20 w-full" /> {/* Placeholder for header */}
        <Skeleton className="h-24 w-full" /> {/* Placeholder for customer */}
        <Skeleton className="h-40 w-full" /> {/* Placeholder for items */}
        <Skeleton className="h-20 w-full" /> {/* Placeholder for notes */}
      </div>
    );
  }

  // If loading is complete but journal wasn't found (also covered by error state)
  if (!journal) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p>Journal not found or access denied.</p>
        <Link href="/" className="text-primary underline mt-4 inline-block">
          Go Home
        </Link>
      </div>
    );
  }

  // Check if it's the correct journal type
  if (journal.journalType !== JOURNAL_TYPES.BUSINESS) {
    return (
      <div className="p-4 text-center text-destructive">
        <p>Error: Estimates can only be added to Business journals.</p>
        <Link href="/" className="text-primary underline mt-4 inline-block">
          Go Home
        </Link>
      </div>
    );
  }

  // Check if currency is set (required for estimates)
  if (!journalCurrency) {
    return (
      <div className="p-4 text-center text-destructive">
        <p>Error: The Business journal is missing a currency setting.</p>
        {/* Optionally link to settings or home */}
        <Link
          href={`/journal?jid=${journalId}`}
          className="text-primary underline mt-4 inline-block"
        >
          Back to Journal
        </Link>
      </div>
    );
  }

  // --- Render EstimateDetails with Props ---
  return (
    <div className="w-full">
      <EstimateDetails
        journalId={journalId!} // Pass journalId (non-null asserted)
        entryId={entryId} // Pass optional entryId
        // Pass data derived from the context's journal object
        supplierInfo={supplierInfo}
        supplierLogo={supplierLogo}
        journalCurrency={journalCurrency}
        journalInventoryCache={journalInventoryCache}
      />
    </div>
  );
}

export default function EditEstimateEntryPage() {
  // Wrap the main content in Suspense because it uses useSearchParams
  return (
    <Suspense fallback={<div className="p-4">Loading...</div>}>
      <EditEstimateEntryPageContent />
    </Suspense>
  );
}
