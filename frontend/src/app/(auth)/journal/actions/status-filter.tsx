"use client";
import React, { useState } from "react";
import { ListFilter, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { WorkStatus } from "@backend/common/common_types";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { getStatusLabel } from "../journal-types/estimate/subcomponents/estimateStatus";

interface StatusFilterProps {
  selectedStatuses: WorkStatus[];
  onStatusChange: (statuses: WorkStatus[]) => void;
}

const ALL_STATUSES: WorkStatus[] = [
  WorkStatus.DRAFT,
  WorkStatus.IN_PROCESS,
  WorkStatus.DELIVERED,
];

const statusDotColors: Record<WorkStatus, string> = {
  [WorkStatus.DRAFT]: "bg-gray-500 dark:bg-gray-400",
  [WorkStatus.IN_PROCESS]: "bg-blue-500 dark:bg-blue-400",
  [WorkStatus.DELIVERED]: "bg-green-500 dark:bg-green-400",
};

export function StatusFilter({
  selectedStatuses,
  onStatusChange,
}: StatusFilterProps) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("journal");
  const t_est = useTranslations("estimate");

  const toggleStatus = (status: WorkStatus) => {
    if (selectedStatuses.includes(status)) {
      onStatusChange(selectedStatuses.filter((s) => s !== status));
    } else {
      onStatusChange([...selectedStatuses, status]);
    }
  };

  const handleSelectAll = () => {
    onStatusChange([...ALL_STATUSES]);
  };

  const handleClear = () => {
    onStatusChange([]);
  };

  const hasSelection = selectedStatuses.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id="status-filter-trigger"
          variant={hasSelection ? "secondary" : "outline"}
          size="icon"
          className={cn(
            "h-9 w-9 relative transition-colors",
            hasSelection &&
              "border-primary/50 text-primary bg-primary/10 hover:bg-primary/20",
          )}
          title={t("statusFilter")}
          aria-label={t("statusFilter")}
        >
          <ListFilter className="h-4 w-4" />
          {hasSelection && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {selectedStatuses.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="flex items-center justify-between pb-2 mb-1 border-b border-border">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {t("filterByStatus")}
          </span>
          {hasSelection && (
            <span className="text-[10px] font-medium bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
              {selectedStatuses.length}/{ALL_STATUSES.length}
            </span>
          )}
        </div>

        <div className="space-y-1 py-1">
          {ALL_STATUSES.map((status) => {
            const isSelected = selectedStatuses.includes(status);
            return (
              <button
                key={status}
                type="button"
                onClick={() => toggleStatus(status)}
                className={cn(
                  "w-full flex items-center justify-between px-2 py-1.5 text-sm rounded-md transition-colors text-left",
                  isSelected
                    ? "bg-accent text-accent-foreground font-medium"
                    : "hover:bg-muted/60 text-foreground",
                )}
                role="checkbox"
                aria-checked={isSelected}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full flex-shrink-0",
                      statusDotColors[status],
                    )}
                  />
                  <span className="truncate">
                    {getStatusLabel(status, t_est)}
                  </span>
                </div>
                <div
                  className={cn(
                    "h-4 w-4 rounded border flex items-center justify-center transition-colors flex-shrink-0 ml-2",
                    isSelected
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-muted-foreground/40",
                  )}
                >
                  {isSelected && <Check className="h-3 w-3" />}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-2 mt-1 border-t border-border gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs font-normal text-muted-foreground hover:text-foreground"
            onClick={handleSelectAll}
            disabled={selectedStatuses.length === ALL_STATUSES.length}
          >
            {t("selectAll")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs font-normal text-muted-foreground hover:text-foreground"
            onClick={handleClear}
            disabled={!hasSelection}
          >
            {t("clearFilters")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
