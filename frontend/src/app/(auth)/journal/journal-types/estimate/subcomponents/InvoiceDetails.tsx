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
        <Label>Order ID</Label>
        <div
          id="orderId"
          className="text-sm font-medium text-muted-foreground"
        >
          {entryId || "Not yet assigned"}
        </div>
      </div>
      <div>
        <Label>Created</Label>
        <div
          id="createdDate"
          className="text-sm font-medium text-muted-foreground"
        >
          {createdDate ? format(createdDate, "PP") : "Not set"}
        </div>
      </div>
      <div className="print:hidden">
        <WorkStatusDropdown qstatus={status} setStatus={handleStatusChange} />
      </div>
    </div>
  );
};
