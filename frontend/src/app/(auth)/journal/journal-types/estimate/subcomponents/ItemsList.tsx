import { Button } from "@/components/ui/button";
import { EllipsisVertical, MinusCircle } from "lucide-react";
import { LineItem } from "@/../../backend/functions/src/common/schemas/estimate_schema";
import { useTranslations } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ItemsListProps {
  confirmedItems: LineItem[];
  removeConfirmedItem: (id: string) => void;
  currencyFormat: (amount: number) => string;
  isSaving: boolean;
  canUpdate: boolean;
}

export const ItemsList = ({
  confirmedItems,
  removeConfirmedItem,
  currencyFormat,
  isSaving,
  canUpdate,
}: ItemsListProps) => {
  const t = useTranslations("estimate.itemsList");
  return (
    <div className="space-y-1">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-2xs text-muted-foreground border-b">
            <th className="text-left py-1 px-1 font-medium">
              {t("headerDescription")}
            </th>

            <th className="text-left py-1 px-1 font-medium w-16">
              {t("headerQty")}
            </th>
            <th className="text-right py-1 px-2 font-medium w-30">
              {t("headerPrice")}
            </th>
            <th className="text-right py-1 px-1 font-medium w-20">
              {t("headerTotal")}
            </th>
            <th className="w-6 print:hidden"></th>
          </tr>
        </thead>
        <tbody>
          {confirmedItems.map((item) => (
            <tr
              key={item.id}
              className={`border-b border-dashed last:border-0 ${
                item.parentId === "root"
                  ? "bg-secondary/30"
                  : "bg-secondary/10"
              }`}
            >
              <td className="py-1 px-1 align-top">
                <div
                  className={`text-sm leading-snug break-words ${
                    item.parentId !== "root"
                      ? "font-normal text-muted-foreground"
                      : "font-semibold"
                  }`}
                >
                  {item.parentId !== "root" && " ↳ "}
                  {item.description}
                  {item.description &&
                    (item.material?.description ||
                      (item.material?.dimensions?.type === "area" &&
                        item.dimensions)) &&
                    " "}
                  <span className="text-2xs text-muted-foreground">
                    {item.material?.description &&
                    item.description !== item.material.description &&
                    item.material?.dimensions?.type === "area" &&
                    item.dimensions ? (
                      <>
                        {item.material.description}: {item.dimensions.length} ×{" "}
                        {item.dimensions.width}{" "}
                        {item.material.dimensions.unitLabel}
                      </>
                    ) : item.material?.description &&
                      !item.parentId &&
                      item.description !== item.material.description ? (
                      <>{item.material.description}</>
                    ) : item.material?.dimensions?.type === "area" &&
                      item.dimensions ? (
                      <>
                        {item.dimensions.length} × {item.dimensions.width}{" "}
                        {item.material.dimensions.unitLabel}
                      </>
                    ) : null}
                  </span>
                </div>
              </td>
              <td className="py-1 px-1 text-left align-top">
                <div className="flex flex-col sm:flex-row sm:items-center sm:gap-1 items-start w-min">
                  <span>{item.quantity}</span>
                  {item.material?.dimensions?.unitLabel && (
                    <span className="text-2xs text-muted-foreground">
                      {item.material.dimensions.unitLabel}
                    </span>
                  )}
                </div>
              </td>
              <td className="py-1 px-1 align-top">
                <div className="text-right pr-2">
                  <span className="inline-flex flex-wrap items-baseline justify-end gap-x-1">
                    <span>
                      {currencyFormat(item.material?.unitPrice || 0)}
                    </span>
                    <span className="text-2xs text-muted-foreground">
                      {`/${item.material?.dimensions?.unitLabel || t("unit")}`}
                    </span>
                  </span>
                </div>
              </td>
              <td className="py-1 px-1 text-right align-top font-semibold">
                {currencyFormat(
                  item.quantity * (item.material?.unitPrice || 0),
                )}
              </td>
              <td className="py-1 px-1 print:hidden align-top">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isSaving || !canUpdate}
                      className="h-6 w-6"
                    >
                      <EllipsisVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem
                      onClick={() => console.log("Edit disabled")}
                      disabled={true}
                    >
                      {t("editItem")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => removeConfirmedItem(item.id)}
                    >
                      {t("removeItem")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
          {confirmedItems.length === 0 && (
            <tr>
              <td
                colSpan={5}
                className="text-center py-3 text-xs text-muted-foreground"
              >
                {t("noItems")}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
