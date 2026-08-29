"use client";
// import { useJournalStore } from "@/lib/store/journalStore";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { JournalProvider, useJournalContext } from "@/context/JournalContext"; // Import provider and hook
import React, { Suspense } from "react"; // Import Suspense
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function JournalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // const currentJournal = useJournalStore((state) => state.currentJournal);
  const t = useTranslations("navigation");

  return (
    // Wrap with Suspense because JournalProvider uses useSearchParams
    <Suspense fallback={<div>{t("loadingContext")}</div>}>
      <JournalProvider>
        <div className="flex flex-col w-full flex-1 min-h-0 print:h-auto print:block print:overflow-visible">
          <JournalBreadcrumb /> {/* Render breadcrumbs that use the context */}
          <div className="flex-1 min-h-0 flex flex-col print:h-auto print:block print:overflow-visible">{children}</div>
        </div>
      </JournalProvider>
    </Suspense>
  );
}
function JournalBreadcrumb() {
  const t = useTranslations("navigation");
  const { journal, jtype } = useJournalContext(); // Use context hook
  if (!journal) return null; // Don't render breadcrumbs if no journal

  const journalLink = `/journal?jid=${journal.id}${jtype ? `&jtype=${jtype}` : ""}`;

  return (
    <div className="print:hidden">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/">{t("home")}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem className="truncate max-w-[150px] sm:max-w-[300px]">
            <BreadcrumbLink asChild>
              <Link href={journalLink}>{journal.title}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
