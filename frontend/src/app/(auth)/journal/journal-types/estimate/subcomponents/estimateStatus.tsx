import { Button } from "@/components/ui/button";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenu,
} from "@/components/ui/dropdown-menu";
import { WorkStatus } from "@/lib/custom_types";
import { useTranslations } from "next-intl";

const statusStyles: Record<WorkStatus, string> = {
  [WorkStatus.DRAFT]:
    "bg-gray-100 border-gray-500 hover:bg-gray-100 dark:bg-gray-900/50 dark:border-gray-500 dark:hover:bg-gray-900/50",
  [WorkStatus.IN_PROCESS]:
    "bg-blue-100 border-blue-500 hover:bg-blue-100 dark:bg-blue-900/50 dark:border-blue-500 dark:hover:bg-blue-900/50",
  [WorkStatus.DELIVERED]:
    "bg-green-100 border-green-500 hover:bg-green-100 dark:bg-green-900/50 dark:border-green-500 dark:hover:bg-green-900/50",
};

interface WorkStatusProps {
  qstatus: WorkStatus;
  setStatus: (status: WorkStatus) => void;
}

export function WorkStatusDropdown({ qstatus, setStatus }: WorkStatusProps) {
  const t = useTranslations("estimate");

  const getStatusLabel = (status: WorkStatus) => {
    switch (status) {
      case WorkStatus.DRAFT:
        return t("statusDraft");
      case WorkStatus.IN_PROCESS:
        return t("statusInProcess");
      case WorkStatus.DELIVERED:
        return t("statusDelivered");
      default:
        return (
          status.charAt(0).toUpperCase() +
          status.slice(1).toLowerCase().replace("_", " ")
        );
    }
  };

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
            {getStatusLabel(qstatus)}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {availableStatuses().map((status) => (
            <DropdownMenuItem key={status} onClick={() => setStatus(status)}>
              {getStatusLabel(status)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  );
}
