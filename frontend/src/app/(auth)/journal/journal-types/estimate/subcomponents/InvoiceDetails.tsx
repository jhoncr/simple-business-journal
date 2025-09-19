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
    <div className="flex justify-between items-start mt-2 border-b pb-1 text-2xs">
      <div>
        <Label className="print:text-2xs">Order ID</Label>
        <div
          id="orderId"
          className="text-xs font-medium text-muted-foreground print:text-2xs"
        >
          {entryId || "Not yet assigned"}
        </div>
      </div>
      <div>
        <Label className="print:text-2xs">Created</Label>
        <div
          id="createdDate"
          className="text-xs font-medium text-muted-foreground print:text-2xs"
        >
          {createdDate ? format(createdDate, "PP") : "Not set"}
        </div>
      </div>
      <div className="hidden print:block">
        <Label className="print:text-2xs">Status</Label>
        <div className="text-xs font-medium text-muted-foreground print:text-2xs">
          {status}
        </div>
      </div>
      <div className="print:hidden">
        <WorkStatusDropdown qstatus={status} setStatus={handleStatusChange} />
      </div>
    </div>
  );
};
