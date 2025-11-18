import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenu,
} from "@/components/ui/dropdown-menu";
import { WorkStatus } from "@/../../backend/functions/src/common/common_types";
import { useTranslations } from "next-intl";

const statusStyles: Record<WorkStatus, string> = {
  [WorkStatus.DRAFT]:
    "bg-gray-100 border-gray-500 hover:bg-gray-100 dark:bg-gray-900/50 dark:border-gray-500 dark:hover:bg-gray-900/50",
  [WorkStatus.IN_PROCESS]:
    "bg-blue-100 border-blue-500 hover:bg-blue-100 dark:bg-blue-900/50 dark:border-blue-500 dark:hover:bg-blue-900/50",
  [WorkStatus.DELIVERED]:
    "bg-green-100 border-green-500 hover:bg-green-100 dark:bg-green-900/50 dark:border-green-500 dark:hover:bg-green-900/50",
};

const getStatusBadgeVariant = (
  status: WorkStatus,
): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case WorkStatus.DRAFT:
      return "default";
    case WorkStatus.IN_PROCESS:
      return "secondary";
    case WorkStatus.DELIVERED:
      return "secondary";
    default:
      return "default";
  }
};

interface WorkStatusProps {
  qstatus: WorkStatus;
  setStatus: (status: WorkStatus) => void;
}

interface WorkStatusBadgeProps {
  status: WorkStatus;
  className?: string;
}

// Utility function to get status label
export const getStatusLabel = (
  status: WorkStatus,
  t: (key: string) => string,
) => {
  switch (status) {
    case WorkStatus.DRAFT:
      return t("statusDraft");
    case WorkStatus.IN_PROCESS:
      return t("statusInProcess");
    case WorkStatus.DELIVERED:
      return t("statusDelivered");
  }
};

// Badge component for display-only status
export function WorkStatusBadge({
  status,
  className = "",
}: WorkStatusBadgeProps) {
  const t = useTranslations("estimate");

  return (
    <Badge
      variant={getStatusBadgeVariant(status)}
      className={`text-xs ${className}`}
    >
      {getStatusLabel(status, t)}
    </Badge>
  );
}

export function WorkStatusDropdown({ qstatus, setStatus }: WorkStatusProps) {
  const t = useTranslations("estimate");

  const availableStatuses = () => {
    return Object.values(WorkStatus).filter((status) => status !== qstatus);
  };

  return (
    qstatus && (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="brutalist"
            size="sm"
            className={`${statusStyles[qstatus]}`}
          >
            {getStatusLabel(qstatus, t)}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {availableStatuses().map((status) => (
            <DropdownMenuItem key={status} onClick={() => setStatus(status)}>
              {getStatusLabel(status, t)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  );
}
