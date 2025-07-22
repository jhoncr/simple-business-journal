import { Button } from "@/components/ui/button";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenu,
} from "@/components/ui/dropdown-menu";
import { EstimateStatus, InvoiceStatus } from "@/lib/custom_types";

const statusStyles: Record<EstimateStatus | InvoiceStatus, string> = {
  [EstimateStatus.DRAFT]:
    "bg-gray-100 border-gray-500 hover:bg-gray-100 dark:bg-gray-900/50 dark:border-gray-500 dark:hover:bg-gray-900/50",
  [EstimateStatus.SENT]:
    "bg-blue-100 border-blue-500 hover:bg-blue-100 dark:bg-blue-900/50 dark:border-blue-500 dark:hover:bg-blue-900/50",
  [EstimateStatus.ACCEPTED]:
    "bg-green-100 border-green-500 hover:bg-green-100 dark:bg-green-900/50 dark:border-green-500 dark:hover:bg-green-900/50",
  [EstimateStatus.DECLINED]:
    "bg-red-100 border-red-500 hover:bg-red-100 dark:bg-red-900/50 dark:border-red-500 dark:hover:bg-red-900/50",
  [EstimateStatus.VOID]:
    "bg-gray-100 border-gray-500 hover:bg-gray-100 dark:bg-gray-900/50 dark:border-gray-500 dark:hover:bg-gray-900/50",
  [InvoiceStatus.INVOICED]:
    "bg-yellow-100 border-yellow-500 hover:bg-yellow-100 dark:bg-yellow-900/50 dark:border-yellow-500 dark:hover:bg-yellow-900/50",
  [InvoiceStatus.PAID]:
    "bg-green-100 border-green-500 hover:bg-green-100 dark:bg-green-900/50 dark:border-green-500 dark:hover:bg-green-900/50",
  [InvoiceStatus.PARTIALLY_PAID]:
    "bg-yellow-100 border-yellow-500 hover:bg-yellow-100 dark:bg-yellow-900/50 dark:border-yellow-500 dark:hover:bg-yellow-900/50",
  [InvoiceStatus.OVERDUE]:
    "bg-red-100 border-red-500 hover:bg-red-100 dark:bg-red-900/50 dark:border-red-500 dark:hover:bg-red-900/50",
};

interface EstimateStatusProps {
  qstatus: EstimateStatus | InvoiceStatus;
  setStatus: (status: EstimateStatus | InvoiceStatus) => void;
}

export function EstimateStatusDropdown({
  qstatus,
  setStatus,
}: EstimateStatusProps) {
  const availableStatuses = () => {
    console.log("Current qstatus:", qstatus);
    switch (qstatus) {
      case EstimateStatus.DRAFT:
        return [EstimateStatus.SENT, EstimateStatus.VOID];
      case EstimateStatus.SENT:
        return [
          EstimateStatus.ACCEPTED,
          EstimateStatus.DECLINED,
          EstimateStatus.VOID,
        ];
      case EstimateStatus.ACCEPTED:
        return [InvoiceStatus.INVOICED];
      case EstimateStatus.DECLINED:
        return [];
      case InvoiceStatus.INVOICED:
        return [
          InvoiceStatus.PAID,
          InvoiceStatus.PARTIALLY_PAID,
          InvoiceStatus.OVERDUE,
          InvoiceStatus.VOID,
        ];
      case InvoiceStatus.PARTIALLY_PAID:
        return [InvoiceStatus.PAID, InvoiceStatus.OVERDUE, InvoiceStatus.VOID];
      case InvoiceStatus.OVERDUE:
        return [
          InvoiceStatus.PAID,
          InvoiceStatus.PARTIALLY_PAID,
          InvoiceStatus.VOID,
        ];
      default:
        return [];
    }
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
            {qstatus}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {availableStatuses().map((status) => (
            <DropdownMenuItem key={status} onClick={() => setStatus(status)}>
              {status}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  );
}
