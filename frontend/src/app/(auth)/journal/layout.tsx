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
import { useSearchParams } from "next/navigation";
import React, { Suspense } from "react"; // Import Suspense
import Link from "next/link";
import { Journal } from "@/lib/custom_types";

export default function JournalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // const currentJournal = useJournalStore((state) => state.currentJournal);

  return (
    // Wrap with Suspense because JournalProvider uses useSearchParams
    <Suspense fallback={<div>Loading journal context...</div>}>
      <JournalProvider>
        <div className="flex flex-col w-full">
          <JournalBreadcrumb /> {/* Render breadcrumbs that use the context */}
          <div className="flex-grow">{children}</div>
        </div>
      </JournalProvider>
    </Suspense>
  );
}
function JournalBreadcrumb() {
  const { journal } = useJournalContext(); // Use context hook
  if (!journal) return null; // Don't render breadcrumbs if no journal

  return (
    <div className="pt-2 print:hidden">
      {/* TODO: improve these breadcrumbs for longer names */}
      <Breadcrumb className="ml-2 overflow-hidden whitespace-nowrap">
        <BreadcrumbList className="overflow-hidden whitespace-nowrap">
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem className="truncate">
            <BreadcrumbLink asChild>
              <Link href={`/journal?jid=${journal.id}`}>{journal.title}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {/* <BreadcrumbSeparator />
          <BreadcrumbItem className="truncate flex items-center space-x-1">
            <span className="truncate">{journal.title}</span>
          </BreadcrumbItem> */}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
