import { Button } from "@/components/ui/button";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenu,
} from "@/components/ui/dropdown-menu";

type StatusType = "pending" | "accepted" | "rejected";

const statusStyles: Record<StatusType, string> = {
  pending:
    "bg-yellow-100 border-yellow-500 hover:bg-yellow-100 dark:bg-yellow-900/50 dark:border-yellow-500 dark:hover:bg-yellow-900/50",
  accepted:
    "bg-green-100 border-green-500 hover:bg-green-100 dark:bg-green-900/50 dark:border-green-500 dark:hover:bg-green-900/50",
  rejected:
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
              {status.charAt(0).toUpperCase() + status.slice(1)}
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
                {qstatus.charAt(0).toUpperCase() + qstatus.slice(1)}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.keys(statusStyles) as StatusType[]).map((status) => (
                <DropdownMenuItem
                  key={status}
                  onClick={() => setStatus(status)}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    )
  );
}
