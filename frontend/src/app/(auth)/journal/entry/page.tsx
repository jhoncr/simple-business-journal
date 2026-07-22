// frontend/src/app/(auth)/journal/entry/page.tsx
"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { StoneForgeEditor } from "@/components/studio/StoneForgeEditor";

import { EstimateDetails } from "@/app/(auth)/journal/journal-types/estimate/addEstimate";

import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { useJournalContext } from "@/context/JournalContext";
import { JOURNAL_TYPES } from "@backend/common/const";
import { BusinessDetailsType } from "@backend/common/schemas/JournalSchema";
import { EntryItf } from "@backend/common/common_types";
import {
  contactInfoSchemaType,
  allowedCurrencySchemaType,
} from "@backend/common/schemas/common_schemas";

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

    // Validate jtype: must be 'estimate', 'invoice', or 'template'
    // This also handles if jtype is null/undefined from the URL.
    if (!jtype || !["estimate", "invoice", "template"].includes(jtype)) {
      setValidationError(
        "A valid entry type ('jtype') of 'estimate', 'invoice', or 'template' must be specified in the URL.",
      );
      return;
    }

    setValidationError(null);

    // Remove the redirect directly to studio for templates
    // if (jtype === "template") {
    //   router.replace(`/studio?jid=${journalId}${entryId ? `&eid=${entryId}` : ''}`);
    // }
  }, [journalId, entryId, jtype]);

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
  if (jtype === "template") {
    return (
      <div className="w-full flex-1 min-h-0 flex flex-col">
        <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading editor...</div>}>
          <StoneForgeEditor />
        </Suspense>
      </div>
    );
  }

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
