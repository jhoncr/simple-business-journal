import { Button } from "@/components/ui/button";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenu,
} from "@/components/ui/dropdown-menu";
import { StatusEnum } from "@/../../backend/functions/src/common/schemas/estimate_schema";
import { z } from "zod";

type StatusType = z.infer<typeof StatusEnum>;

const statusStyles: Record<StatusType, string> = {
  Draft:
    "bg-gray-100 border-gray-500 hover:bg-gray-100 dark:bg-gray-900/50 dark:border-gray-500 dark:hover:bg-gray-900/50",
  Estimate:
    "bg-blue-100 border-blue-500 hover:bg-blue-100 dark:bg-blue-900/50 dark:border-blue-500 dark:hover:bg-blue-900/50",
  Accepted:
    "bg-green-100 border-green-500 hover:bg-green-100 dark:bg-green-900/50 dark:border-green-500 dark:hover:bg-green-900/50",
  Pending:
    "bg-yellow-100 border-yellow-500 hover:bg-yellow-100 dark:bg-yellow-900/50 dark:border-yellow-500 dark:hover:bg-yellow-900/50",
  Paid: "bg-green-100 border-green-500 hover:bg-green-100 dark:bg-green-900/50 dark:border-green-500 dark:hover:bg-green-900/50",
  Cancelled:
    "bg-gray-100 border-gray-500 hover:bg-gray-100 dark:bg-gray-900/50 dark:border-gray-500 dark:hover:bg-gray-900/50",
  Rejected:
    "bg-red-100 border-red-500 hover:bg-red-100 dark:bg-red-900/50 dark:border-red-500 dark:hover:bg-red-900/50",
  Overdue:
    "bg-red-100 border-red-500 hover:bg-red-100 dark:bg-red-900/50 dark:border-red-500 dark:hover:bg-red-900/50",
};

interface EstimateStatusProps {
  qstatus: StatusType;
  setStatus: (status: StatusType) => void;
}

export function EstimateStatus({ qstatus, setStatus }: EstimateStatusProps) {
  return (
    qstatus && (
      <div className="flex items-center gap-2">
        <div className="hidden md:flex gap-2">
          {(Object.keys(statusStyles) as StatusType[]).map((status) => (
            <Button
              key={status}
              variant="outline"
              size="sm"
              className={`rounded-full ${
                qstatus === status ? statusStyles[status] : ""
              }`}
              onClick={() => setStatus(status)}
            >
              {status}
            </Button>
          ))}
        </div>
        <div className="md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={`rounded-full ${statusStyles[qstatus]}`}
              >
                {qstatus}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.keys(statusStyles) as StatusType[]).map((status) => (
                <DropdownMenuItem
                  key={status}
                  onClick={() => setStatus(status)}
                >
                  {status}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    )
  );
}
