import { format } from "date-fns";
import { Label } from "@/components/ui/label";
import { WorkStatusDropdown } from "./estimateStatus";
import { WorkStatus } from "@/lib/custom_types";

interface InvoiceDetailsProps {
  entryId: string | null | undefined;
  createdDate: Date | null | undefined;
  status: WorkStatus;
  handleStatusChange: (newStatus: WorkStatus) => void;
}

export const InvoiceDetails = ({
  entryId,
  createdDate,
  status,
  handleStatusChange,
}: InvoiceDetailsProps) => {
  console.log("Rendering InvoiceDetails with createdDate:", createdDate);
  return (
    <div className="flex justify-between items-start mt-4 border-b pb-1">
      <div>
        <Label className="print:text-xs">Order ID</Label>
        <div
          id="orderId"
          className="text-sm font-medium text-muted-foreground print:text-xs"
        >
          {entryId || "Not yet assigned"}
        </div>
      </div>
      <div>
        <Label className="print:text-xs">Created</Label>
        <div
          id="createdDate"
          className="text-sm font-medium text-muted-foreground print:text-xs"
        >
          {createdDate ? format(createdDate, "PP") : "Not set"}
        </div>
      </div>
      <div className="hidden print:block">
        <Label className="print:text-xs">Status</Label>
        <div className="text-sm font-medium text-muted-foreground print:text-xs">
          {status}
        </div>
      </div>
      <div className="print:hidden">
        <WorkStatusDropdown qstatus={status} setStatus={handleStatusChange} />
      </div>
    </div>
  );
};
