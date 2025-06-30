// frontend/src/app/(auth)/journal/entry/page.tsx
"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import { EstimateDetails } from "@/app/(auth)/journal/journal-types/estimate/addEstimate";

import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { useJournalContext } from "@/context/JournalContext";
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

// Renamed component to be more generic
function EntryDetailsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const journalId = searchParams.get("jid");
  const entryId = searchParams.get("eid") || undefined;
  const jtype = searchParams.get("jtype"); // This is the 'type' from URL ('estimate' or 'invoice')

  const {
    journal,
    loading: isJournalLoading,
    error: contextJournalError,
  } = useJournalContext();

  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setValidationError(null);

    if (!journalId) {
      setValidationError("Journal ID (jid) is missing in the URL.");
      return;
    }

    if (entryId && !/^[a-zA-Z0-9-_]{15,}$/.test(entryId)) {
      setValidationError("Invalid entry ID (eid) format in the URL.");
      return;
    }

    // Validate jtype: must be 'estimate' or 'invoice'
    // This also handles if jtype is null/undefined from the URL.
    // Links creating new entries should ensure jtype is set.
    // If opening an existing entry, jtype might not be in URL, but logic might fetch entry first then determine type.
    // For simplicity here, we rely on jtype for new/edit.
    if (!jtype || !["estimate", "invoice"].includes(jtype)) {
      setValidationError(
        "A valid entry type ('jtype') of 'estimate' or 'invoice' must be specified in the URL.",
      );
      return;
    }

    setValidationError(null);
  }, [journalId, entryId, jtype, router]);

  let supplierInfo: contactInfoSchemaType = initInfo;
  let supplierLogo: string | null = null;
  let journalCurrency: allowedCurrencySchemaType | undefined;
  let journalInventoryCache: Record<string, EntryItf> = {};

  if (journal && journal.journalType === JOURNAL_TYPES.BUSINESS) {
    const details = journal.details as BusinessDetailsType | undefined;
    supplierInfo = details?.contactInfo || initInfo;
    supplierLogo = details?.logo || null;
    journalCurrency = details?.currency;
    journalInventoryCache = (journal as any)?.inventoryCache || {};
  }

  const combinedError = validationError || contextJournalError;

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

  if (isJournalLoading) {
    return (
      <div className="p-4 space-y-4 max-w-4xl mx-auto">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

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

  // Both estimates and invoices are assumed to be part of BUSINESS journals
  if (journal.journalType !== JOURNAL_TYPES.BUSINESS) {
    return (
      <div className="p-4 text-center text-destructive">
        <p>
          Error: This entry type can only be managed within Business journals.
        </p>
        <Link href="/" className="text-primary underline mt-4 inline-block">
          Go Home
        </Link>
      </div>
    );
  }

  if (!journalCurrency) {
    return (
      <div className="p-4 text-center text-destructive">
        <p>Error: The Business journal is missing a currency setting.</p>
        <Link
          href={`/journal?jid=${journalId}`}
          className="text-primary underline mt-4 inline-block"
        >
          Back to Journal
        </Link>
      </div>
    );
  }

  // Conditional rendering based on jtype
  return (
    <div className="w-full">
      <EstimateDetails
        journalId={journalId!}
        entryId={entryId}
        supplierInfo={supplierInfo}
        supplierLogo={supplierLogo}
        journalCurrency={journalCurrency}
        journalInventoryCache={journalInventoryCache}
        jtype={jtype!} // Pass the validated jtype
      />
    </div>
  );
}

// Renamed default export
export default function EntryDetailsPage() {
  return (
    <Suspense fallback={<div className="p-4">Loading...</div>}>
      <EntryDetailsPageContent />
    </Suspense>
  );
}
