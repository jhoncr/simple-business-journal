import { format } from "date-fns";
import { Label } from "@/components/ui/label";
import { WorkStatusDropdown, getStatusLabel } from "./estimateStatus";
import { WorkStatus } from "@backend/common/common_types";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("estimate");
  console.log("Rendering InvoiceDetails with createdDate:", createdDate);
  return (
    <div className="flex justify-between items-start mt-2 border-b pb-1 text-2xs">
      <div>
        <Label className="print:text-2xs">{t("orderId")}</Label>
        <div
          id="orderId"
          className="text-xs font-medium text-muted-foreground print:text-2xs"
        >
          {entryId || t("notYetAssigned")}
        </div>
      </div>
      <div>
        <Label className="print:text-2xs">{t("created")}</Label>
        <div
          id="createdDate"
          className="text-xs font-medium text-muted-foreground print:text-2xs"
        >
          {createdDate ? format(createdDate, "PP") : t("notSet")}
        </div>
      </div>
      <div className="hidden print:block">
        <Label className="print:text-2xs">{t("status")}</Label>
        <div className="text-xs font-medium text-muted-foreground print:text-2xs">
          {getStatusLabel(status, t)}
        </div>
      </div>
      <div className="print:hidden">
        <WorkStatusDropdown qstatus={status} setStatus={handleStatusChange} />
      </div>
    </div>
  );
};
