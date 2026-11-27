import { Button } from "@/components/ui/button";
import { EllipsisVertical } from "lucide-react";
import { LineItem } from "@backend/common/schemas/estimate_schema";
import { useTranslations } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ItemActionMenuProps {
  item: LineItem;
  editItem: (item: LineItem) => void;
  removeConfirmedItem: (id: string) => void;
  editingItem?: LineItem | null;
  canUpdate: boolean;
  isSaving: boolean;
}

export const ItemActionMenu = ({
  item,
  editItem,
  removeConfirmedItem,
  editingItem,
  canUpdate,
  isSaving,
}: ItemActionMenuProps) => {
  const t = useTranslations("estimate.itemsList");
  const tCommon = useTranslations("common");
  const isRoot = !item.parentId || item.parentId === "root";
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={isSaving || !canUpdate}
          className="h-6 w-6"
          aria-label={tCommon("openMenu")}
        >
          <EllipsisVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem
          onSelect={(e) => e.preventDefault()}
          onClick={() => {
            editItem(item);
          }}
          disabled={!canUpdate || !isRoot || !!editingItem}
        >
          {editingItem?.id === item.id
            ? t("editingInProgress")
            : item.attachedTemplate
              ? t("editItemAnd3DModel")
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
  );
};
