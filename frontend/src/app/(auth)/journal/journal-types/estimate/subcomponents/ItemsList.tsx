import { Button } from "@/components/ui/button";
import { EllipsisVertical, ListTree, List } from "lucide-react";
import { LineItem } from "@/../../backend/functions/src/common/schemas/estimate_schema";
import { useTranslations } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ButtonGroup } from "@/components/ui/button-group";
import { useState } from "react";

interface ItemsListProps {
  confirmedItems: LineItem[];
  removeConfirmedItem: (id: string) => void;
  editItem: (item: LineItem) => void;
  editingItem?: LineItem | null;
  currencyFormat: (amount: number) => string;
  isSaving: boolean;
  canUpdate: boolean;
}

interface AggregatedItem extends LineItem {
  children: LineItem[];
  childrenTotal: number;
  itemTotal: number;
  total: number;
}

export const ItemsList = ({
  confirmedItems,
  removeConfirmedItem,
  editItem,
  editingItem,
  currencyFormat,
  isSaving,
  canUpdate,
}: ItemsListProps) => {
  const t = useTranslations("estimate.itemsList");
  const [viewType, setViewType] = useState<"expanded" | "aggregated">(
    "expanded",
  );

  const isItemBeingEdited = (item: LineItem) => {
    if (!editingItem) return false;
    // Check if this item is the one being edited
    if (item.id === editingItem.id) return true;
    // Check if this item is a child of the item being edited
    if (item.parentId === editingItem.id) return true;
    return false;
  };

  const aggregatedItems = confirmedItems.reduce((acc, item) => {
    if (item.parentId === "root") {
      const children = confirmedItems.filter((i) => i.parentId === item.id);
      const childrenTotal = children.reduce(
        (sum, child) =>
          sum + child.quantity * (child.material?.unitPrice || 0),
        0,
      );
      const itemTotal = item.quantity * (item.material?.unitPrice || 0);
      const total = itemTotal + childrenTotal;

      acc.push({
        ...item,
        children,
        childrenTotal,
        itemTotal,
        total,
      });
    }
    return acc;
  }, [] as AggregatedItem[]);

  return (
    <div className="space-y-2">
      <ButtonGroup className="float-right print:hidden">
        <Button
          variant={viewType === "expanded" ? "default" : "outline"}
          onClick={() => setViewType("expanded")}
          size="sm"
        >
          {/* {t("viewExpanded")}
           */}
          <ListTree className="h-4 w-4" />
        </Button>
        <Button
          variant={viewType === "aggregated" ? "default" : "outline"}
          onClick={() => setViewType("aggregated")}
          size="sm"
        >
          {/* {t("viewAggregated")}
           */}
          <List className="h-4 w-4" />
        </Button>
      </ButtonGroup>
      {viewType === "expanded" ? <ExpandedView /> : <AggregatedView />}
    </div>
  );

  function AggregatedView() {
    return (
      <table className="w-full text-xs">
        <thead>
          <tr className="text-2xs text-muted-foreground border-b">
            <th className="text-left py-1 px-1 font-medium">
              {t("headerDescription")}
            </th>
            <th className="text-right py-1 px-1 font-medium w-24">
              {t("headerTotal")}
            </th>
            <th className="w-6 print:hidden"></th>
          </tr>
        </thead>
        <tbody>
          {aggregatedItems.map((item) => (
            <tr
              key={item.id}
              className={`border-b border-dashed last:border-0 ${
                isItemBeingEdited(item)
                  ? "bg-orange-500/20"
                  : "bg-secondary/30"
              }`}
            >
              <td className="py-1 px-1 align-top">
                <div className="text-sm leading-snug break-words font-semibold">
                  {item.description}
                </div>
                <div className="text-2xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1">
                  {item.material?.dimensions?.type === "area" &&
                  item.dimensions ? (
                    <>
                      {item.dimensions.length} × {item.dimensions.width}{" "}
                      {item.material.dimensions.unitLabel}
                    </>
                  ) : (
                    <>
                      {item.quantity}{" "}
                      {item.material?.dimensions?.unitLabel || t("unit")}
                    </>
                  )}
                  <span>×</span>
                  <span>
                    {currencyFormat(item.material?.unitPrice || 0)}
                    {`/${item.material?.dimensions?.unitLabel || t("unit")}`}
                  </span>
                  {item.childrenTotal > 0 && (
                    <span>+ {t("headerService")}</span>
                  )}
                </div>
              </td>
              <td className="py-1 px-1 text-right align-top font-semibold">
                {currencyFormat(item.total)}
              </td>
              <td className="py-1 px-1 print:hidden align-top">
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isSaving || !canUpdate}
                      className="h-6 w-6"
                      onAbort={(e) => e.preventDefault()}
                    >
                      <EllipsisVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem
                      onSelect={(e) => e.preventDefault()}
                      onClick={(e) => {
                        editItem(item);
                      }}
                      disabled={
                        !canUpdate || item.parentId !== "root" || !!editingItem
                      }
                    >
                      {editingItem?.id === item.id
                        ? "Editing..."
                        : t("editItem")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={(e) => e.preventDefault()}
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
                colSpan={3}
                className="text-center py-3 text-xs text-muted-foreground"
              >
                {t("noItems")}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    );
  }

  function ExpandedView() {
    return (
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
                isItemBeingEdited(item)
                  ? "bg-orange-500/20"
                  : item.parentId === "root"
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
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isSaving || !canUpdate}
                      className="h-6 w-6"
                      onAbort={(e) => e.preventDefault()}
                    >
                      <EllipsisVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem
                      onSelect={(e) => e.preventDefault()}
                      onClick={(e) => {
                        editItem(item);
                      }}
                      disabled={
                        !canUpdate || item.parentId !== "root" || !!editingItem
                      }
                    >
                      {editingItem?.id === item.id
                        ? "Editing..."
                        : t("editItem")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={(e) => e.preventDefault()}
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
    );
  }
};
