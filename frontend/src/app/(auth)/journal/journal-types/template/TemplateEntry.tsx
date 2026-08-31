import React from "react";
import { EntryView } from "../../comp/EntryView";
import { EntryType } from "@backend/common/schemas/configmap";
import { DBentry, AccessUser } from "@/lib/custom_types";
import { formattedDate } from "@/lib/utils";
import Link from "next/link";
import { Box } from "lucide-react";
import { useTranslations } from "next-intl";

interface TemplateEntryProps {
  journalId: string;
  entry: DBentry;
  entryType: EntryType;
  user: AccessUser | null;
  role: string;
  removeFn: (entry: DBentry) => void;
  onDuplicated?: (newEntryId: string) => void;
}

export const TemplateEntry = React.memo(function TemplateEntry({
  journalId,
  entry,
  entryType,
  user,
  role,
  removeFn,
  onDuplicated,
}: TemplateEntryProps) {
  const t = useTranslations("template");
  if (!journalId || !entry || entryType !== "template") return null;

  return (
    <EntryView
      journalId={journalId}
      entry={entry}
      entryType={entryType}
      user={user}
      role={role}
      removeFn={removeFn}
      onDuplicated={onDuplicated}
    >
      <Link
        href={`/journal/entry?jid=${journalId}&eid=${entry.id}&jtype=template`}
        className="block hover:bg-accent/50 transition-colors rounded-md -m-2 p-2"
      >
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <Box className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1 hidden md:block" />
          <div className="flex-grow min-w-0 w-full">
            <div className="flex items-start justify-between gap-3 mb-1">
              <span className="font-medium break-words flex-1 min-w-0 overflow-hidden" title={entry.name}>
                {entry.name || t("unnamedTemplate")}
              </span>
            </div>
            <div className="text-sm text-muted-foreground whitespace-nowrap mt-1">
              {formattedDate(entry.createdAt)}
            </div>
          </div>
        </div>
      </Link>
    </EntryView>
  );
});
