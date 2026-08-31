import { Button } from "@/components/ui/button";
import { EllipsisVertical, ListTree, List, RectangleEllipsis, RectangleHorizontal, Cuboid } from "lucide-react";
import { LineItem } from "@backend/common/schemas/estimate_schema";
import { useTranslations } from "next-intl";
import { ItemActionMenu } from "./ItemActionMenu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ButtonGroup } from "@/components/ui/button-group";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const getItemDetails = (item: LineItem) => {
  const hasCategory = item.itemCategory && item.itemCategory !== "none";

  let detailContent = null;
  if (
    item.material?.description &&
    item.description !== item.material.description &&
    item.material?.dimensions?.type === "area" &&
    item.dimensions
  ) {
    detailContent = (
      <>
        {item.material.description}: {item.dimensions.length} ×{" "}
        {item.dimensions.width} {item.material.dimensions.unitLabel}
      </>
    );
  } else if (
    item.material?.description &&
    !item.parentId &&
    item.description !== item.material.description
  ) {
    detailContent = <>{item.material.description}</>;
  } else if (
    item.material?.dimensions?.type === "area" &&
    item.dimensions
  ) {
    detailContent = (
      <>
        {item.dimensions.length} × {item.dimensions.width}{" "}
        {item.material.dimensions.unitLabel}
      </>
    );
  }

  return { hasCategory, detailContent };
};

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

const TechnicalDrawingIndicator = ({ category }: { category?: string }) => {
  const t = useTranslations("estimate.itemsList");

  if (!category || category === "none") return null;

  const Icon = category === "window-sill" ? RectangleEllipsis : category === "gallery" ? Cuboid : RectangleHorizontal;

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center justify-center shrink-0">
            <Icon className="h-3 w-3" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>{t("hasTechnicalDrawing")}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};


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
    "aggregated",
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
    <div className="flex flex-col mb-2">
      <div className="flex justify-end print:hidden relative z-10 -mt-[34px] mb-2">
        <ButtonGroup>
          <Button
            variant={viewType === "expanded" ? "default" : "outline"}
            onClick={() => setViewType("expanded")}
            size="sm"
          >
            <ListTree className="h-4 w-4" />
          </Button>
          <Button
            variant={viewType === "aggregated" ? "default" : "outline"}
            onClick={() => setViewType("aggregated")}
            size="sm"
          >
            <List className="h-4 w-4" />
          </Button>
        </ButtonGroup>
      </div>
      {viewType === "expanded" ? <ExpandedView /> : <AggregatedView />}
    </div>
  );

  function AggregatedView() {
    return (
      <Table className="w-full text-xs">
        <TableHeader className="print:table-header-group">
          <TableRow className="text-2xs text-muted-foreground border-b">
            <TableHead className="text-left py-1 px-1 font-medium">
              {t("headerDescription")}
            </TableHead>
            <TableHead className="text-right py-1 px-1 font-medium w-24">
              {t("headerTotal")}
            </TableHead>
            <TableHead className="w-6 print:hidden"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {aggregatedItems.map((item) => (
            <TableRow
              key={item.id}
              className={`break-inside-avoid print:break-inside-avoid border-b border-dashed last:border-0 ${isItemBeingEdited(item)
                ? "bg-orange-500/20"
                : "bg-muted/50"
                }`}
            >
              <TableCell className="py-2 px-1 align-top">
                <div className="text-sm leading-snug break-words font-semibold">
                  {item.description}
                </div>
                <div className="text-2xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1">
                  <TechnicalDrawingIndicator category={item.itemCategory} />
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

              </TableCell>
              <TableCell className="py-2 px-1 text-right align-top font-semibold">
                {currencyFormat(item.total)}
              </TableCell>
              <TableCell className="py-2 px-1 print:hidden align-top">
                <ItemActionMenu
                  item={item}
                  editItem={editItem}
                  removeConfirmedItem={removeConfirmedItem}
                  editingItem={editingItem}
                  canUpdate={canUpdate}
                  isSaving={isSaving}
                />
              </TableCell>
            </TableRow>
          ))}
          {confirmedItems.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={3}
                className="text-center py-3 text-xs text-muted-foreground"
              >
                {t("noItems")}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    );
  }

  function ExpandedView() {
    return (
      <Table className="w-full text-xs">
        <TableHeader className="print:table-header-group">
          <TableRow className="text-2xs text-muted-foreground border-b">
            <TableHead className="text-left py-1 px-1 font-medium">
              {t("headerDescription")}
            </TableHead>

            <TableHead className="text-left py-1 px-1 font-medium w-16">
              {t("headerQty")}
            </TableHead>
            <TableHead className="text-right py-1 px-2 font-medium w-30">
              {t("headerPrice")}
            </TableHead>
            <TableHead className="text-right py-1 px-1 font-medium w-20">
              {t("headerTotal")}
            </TableHead>
            <TableHead className="w-6 print:hidden"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {confirmedItems.map((item) => (
            <TableRow
              key={item.id}
              className={`break-inside-avoid print:break-inside-avoid border-b border-dashed last:border-0 ${isItemBeingEdited(item)
                ? "bg-orange-500/20"
                : item.parentId === "root"
                  ? "bg-muted/50"
                  : "bg-muted/20"
                }`}
            >
              <TableCell className="py-2 px-1 align-top">
                <div
                  className={`text-sm leading-snug break-words ${item.parentId !== "root"
                    ? "font-normal text-muted-foreground"
                    : "font-semibold"
                    }`}
                >
                  {item.parentId !== "root" && " ↳ "}
                  {item.description}

                  {(() => {
                    const { hasCategory, detailContent } = getItemDetails(item);

                    if (!hasCategory && !detailContent) return null;

                    return (
                      <div className="text-2xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1">
                        <TechnicalDrawingIndicator category={item.itemCategory} />
                        {detailContent && <span>{detailContent}</span>}
                      </div>
                    );
                  })()}
                </div>

              </TableCell>
              <TableCell className="py-2 px-1 text-left align-top">
                <div className="flex flex-col sm:flex-row sm:items-center sm:gap-1 items-start w-min">
                  <span>{item.quantity}</span>
                  {item.material?.dimensions?.unitLabel && (
                    <span className="text-2xs text-muted-foreground">
                      {item.material.dimensions.unitLabel}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="py-2 px-1 align-top">
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
              </TableCell>
              <TableCell className="py-2 px-1 text-right align-top font-semibold">
                {currencyFormat(
                  item.quantity * (item.material?.unitPrice || 0),
                )}
              </TableCell>
              <TableCell className="py-2 px-1 print:hidden align-top">
                <ItemActionMenu
                  item={item}
                  editItem={editItem}
                  removeConfirmedItem={removeConfirmedItem}
                  editingItem={editingItem}
                  canUpdate={canUpdate}
                  isSaving={isSaving}
                />
              </TableCell>
            </TableRow>
          ))}
          {confirmedItems.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-center py-3 text-xs text-muted-foreground"
              >
                {t("noItems")}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    );
  }
};
