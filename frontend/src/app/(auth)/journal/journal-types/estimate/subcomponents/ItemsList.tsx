import { Button } from "@/components/ui/button";
import { MinusCircle } from "lucide-react";
import { LineItem } from "@/../../backend/functions/src/common/schemas/estimate_schema";

interface ItemsListProps {
  confirmedItems: LineItem[];
  removeConfirmedItem: (id: string) => void;
  currencyFormat: (amount: number) => string;
  isSaving: boolean;
  canUpdate: boolean;
}

export const ItemsList = ({ confirmedItems, removeConfirmedItem, currencyFormat, isSaving, canUpdate }: ItemsListProps) => {
  return (
    <div className="space-y-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground border-b">
            <th className="text-left py-2 px-1 font-medium w-20">Qty</th>
            <th className="text-left py-2 px-1 font-medium">Description</th>
            <th className="text-right py-2 px-2 font-medium w-24">Price</th>
            <th className="text-right py-2 px-1 font-medium w-24">Total</th>
            <th className="w-8 print:hidden"></th>
          </tr>
        </thead>
        <tbody>
          {confirmedItems.map((item) => (
            <tr
              key={item.id}
              className={`border-b border-dashed last:border-0 ${
                item.parentId === "root" ? "bg-secondary/30" : ""
              }`}
            >
              <td className="py-2 px-1 text-left align-top">
                <div className="flex flex-col items-center w-min">
                  {item.quantity}
                  <div className="text-xs text-muted-foreground">
                    {item.material?.dimensions?.unitLabel || ""}
                  </div>
                </div>
              </td>
              <td className="py-2 px-1 align-top">
                {item.description && (
                  <div className="text-sm">{item.description}</div>
                )}
                <div className="text-xs text-muted-foreground flex flex-row items-center gap-1">
                  {item.material?.description &&
                    item.description !== item.material.description && (
                      <div className="">
                        {item.material.description}
                      </div>
                    )}
                  {item.material?.dimensions?.type === "area" &&
                    item.dimensions && (
                      <div className="">
                        : {item.dimensions.length} ×{" "}
                        {item.dimensions.width}{" "}
                        {item.material.dimensions.unitLabel}
                      </div>
                    )}
                </div>
              </td>
              <td className="py-2 px-1 align-top">
                <div className="text-right pr-2">
                  {currencyFormat(item.material?.unitPrice || 0)}
                  <div className="text-xs text-muted-foreground">
                    {`/${
                      item.material?.dimensions?.unitLabel || "unit"
                    }`}
                  </div>
                </div>
              </td>
              <td className="py-2 px-1 text-right align-top">
                {currencyFormat(
                  item.quantity * (item.material?.unitPrice || 0),
                )}
              </td>
              <td className="py-2 px-1 print:hidden align-top">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeConfirmedItem(item.id)}
                  disabled={isSaving || !canUpdate}
                  className="h-8 w-8"
                >
                  <MinusCircle className="h-4 w-4 text-muted-foreground" />
                </Button>
              </td>
            </tr>
          ))}
          {confirmedItems.length === 0 && (
            <tr>
              <td
                colSpan={5}
                className="text-center py-4 text-sm text-muted-foreground"
              >
                Add items using the form below.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};