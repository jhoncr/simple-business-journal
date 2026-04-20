import { useState, useRef, useMemo, useEffect, useId } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, PackagePlus, Loader2 } from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useTranslations } from "next-intl";
import { LineItem, AttachedTemplate } from "@backend/common/schemas/estimate_schema";
import { allowedCurrencySchemaType, ROLES } from "@backend/common/schemas/common_schemas";
import { EntryItf } from "@backend/common/common_types";
import { ROLES_THAT_ADD } from "@backend/common/const";
import { DBentry } from "@/lib/custom_types";
import { AssemblyTemplate } from "@backend/common/schemas/studio";
import { StoneForgeViewer } from "@/components/studio/StoneForgeViewer";
import { StoneForgeVariableEditor } from "@/components/studio/StoneForgeVariableEditor";
import { useParams, useSearchParams } from "next/navigation";
import { TemplateGalleryModal } from "./TemplateGalleryModal";
import { NewItemForm, NewItemFormHandle } from "./NewItemForm/NewItemForm";

interface NewItemFormWrapperProps {
  onAddItem: (items: LineItem[]) => Promise<boolean>;
  currency: allowedCurrencySchemaType;
  inventoryCache: Record<string, EntryItf>;
  userRole: (typeof ROLES)[number];
  editingItem?: LineItem | null;
  onCancelEdit?: () => void;
  confirmedItems?: LineItem[];
}

export function NewItemFormWrapper({
  onAddItem,
  currency,
  userRole,
  editingItem,
  onCancelEdit,
  confirmedItems = [],
}: NewItemFormWrapperProps) {
  const formId = useId();
  const t = useTranslations("newItemForm");
  const tCommon = useTranslations("common");
  const [isOpen, setIsOpen] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const templateJustSelectedRef = useRef(false);
  const isDesktop = useMediaQuery("(min-width: 1340px)");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const params = useParams();
  const searchParams = useSearchParams();
  const journalId = (params?.journalId as string) || searchParams?.get("jid") || "";

  const [attachedTemplate, setAttachedTemplate] = useState<AttachedTemplate | null>(null);
  const canAdd = useMemo(() => ROLES_THAT_ADD.has(userRole), [userRole]);

  const formRef = useRef<NewItemFormHandle>(null);

  useEffect(() => {
    if (editingItem && editingItem.parentId === "root") {
      setAttachedTemplate(editingItem.attachedTemplate || null);
      setIsOpen(true);
    } else if (!editingItem) {
      setAttachedTemplate(null);
      setIsOpen(false);
    }
  }, [editingItem]);

  const handleSelectTemplate = (templateEntry: DBentry) => {
    const templateDetails = templateEntry.details as AssemblyTemplate;

    const newAttachedTemplate: AttachedTemplate = {
      sourceTemplateId: templateEntry.id,
      snapshot: JSON.parse(JSON.stringify(templateDetails)), 
      variableOverrides: {},
    };

    templateJustSelectedRef.current = true;
    setAttachedTemplate(newAttachedTemplate);
    if (formRef.current) {
      formRef.current.onTemplateSelected(templateDetails.name || "Template");
    }
    setIsGalleryOpen(false);
    setIsOpen(true);
  };

  const handleVariableChange = (variableId: string, newValue: number) => {
    if (!attachedTemplate) return;

    setAttachedTemplate({
      ...attachedTemplate,
      variableOverrides: {
        ...(attachedTemplate.variableOverrides || {}),
        [variableId]: newValue
      }
    });
  };

  const mergedVariables = useMemo(() => {
    if (!attachedTemplate) return {};

    const merged: Record<string, number> = {};
    attachedTemplate.snapshot.variables.forEach(v => {
      if (v.label) {
        merged[v.label] = v.default;
      }
    });

    Object.entries(attachedTemplate.variableOverrides || {}).forEach(([id, value]) => {
      const variable = attachedTemplate.snapshot.variables.find(v => v.id === id);
      if (variable && variable.label) {
        merged[variable.label] = value;
      }
    });

    return merged;
  }, [attachedTemplate]);

  const onSuccess = () => {
    setAttachedTemplate(null);
    setIsOpen(false);
    if (editingItem && onCancelEdit) {
      onCancelEdit();
    }
  };

  const handleClearTemplate = () => {
    setAttachedTemplate(null);
    if (formRef.current) {
      formRef.current.resetOnGalleryDismiss();
    }
  };

  const formContent = (
    <>
      <NewItemForm
        ref={formRef}
        formId={formId}
        onAddItem={onAddItem}
        currency={currency}
        userRole={userRole}
        editingItem={editingItem}
        confirmedItems={confirmedItems}
        attachedTemplate={attachedTemplate}
        onOpenGallery={() => {
          if (!attachedTemplate) setIsGalleryOpen(true);
        }}
        onSuccess={onSuccess}
        setIsSubmitting={setIsSubmitting}
      />
      {attachedTemplate && (
        <div className="mt-6 mb-2 mx-4 border rounded-md overflow-hidden bg-white shadow-sm flex-shrink-0">
          <StoneForgeVariableEditor
            template={attachedTemplate.snapshot}
            overrides={attachedTemplate.variableOverrides}
            onVariableChange={handleVariableChange}
            scrollable={false}
          />
        </div>
      )}
    </>
  );

  const combinedContent = attachedTemplate ? (
    <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] lg:grid-cols-[2fr_1fr] gap-6 h-full min-h-[600px]">
      {/* LEFT PANE: 3D Viewer */}
      <div className="flex flex-col h-full bg-secondary/20 rounded-md overflow-hidden border relative min-h-[400px]">
        <StoneForgeViewer
          components={attachedTemplate.snapshot.components}
          variables={mergedVariables}
          fixedCameraView={attachedTemplate.snapshot.cameraViews?.[0]}
        />
      </div>

      {/* RIGHT PANE: Form & Variables */}
      <div className="flex flex-col h-full overflow-hidden border-l pl-0 md:pl-2">
        {formContent}
      </div>
    </div>
  ) : (
    <div className="flex-grow overflow-y-auto pr-2">{formContent}</div>
  );

  if (isDesktop) {
    return (
      <>
        <div
          id="estimate-add-item-form"
          className={`print:hidden fixed bottom-4 right-4 z-50 bg-background border rounded-lg p-4 shadow-lg max-h-[calc(100vh-4rem)] flex flex-col ${attachedTemplate ? 'w-[95vw] max-w-7xl' : 'w-[400px]'}`}
        >
          <div className="mb-4 flex-shrink-0">
            <h3 className="text-lg font-semibold">
              {editingItem ? t("editItem") : t("title")}
            </h3>
          </div>
          <div className="flex-grow overflow-y-auto pr-2">{combinedContent}</div>
          <div className="flex justify-end gap-2 mt-4 flex-shrink-0">
            {editingItem && onCancelEdit && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAttachedTemplate(null);
                  onCancelEdit();
                }}
              >
                {t("cancel")}
              </Button>
            )}
            {!editingItem && attachedTemplate && (
              <Button
                type="button"
                variant="outline"
                onClick={handleClearTemplate}
              >
                Clear Template
              </Button>
            )}
            <Button
              type="submit"
              form={formId}
              disabled={isSubmitting || !canAdd}
              variant={"brutalist"}
              title={!canAdd ? t("permissionDenied") : ""}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("saving")}
                </>
              ) : (
                <>
                  <Plus className="mr-2" size={16} />
                  {editingItem ? t("updateItem") : t("addItem")}
                </>
              )}
            </Button>
          </div>
        </div>

        <TemplateGalleryModal
          journalId={journalId}
          onSelectTemplate={handleSelectTemplate}
          disabled={!canAdd}
          open={isGalleryOpen}
          onOpenChange={(open) => {
            setIsGalleryOpen(open);
            if (!open && templateJustSelectedRef.current) {
              templateJustSelectedRef.current = false;
            } else if (!open && !attachedTemplate) {
              if (formRef.current) formRef.current.resetOnGalleryDismiss();
            }
          }}
        />
      </>
    );
  }

  return (
    <div id="estimate-add-item-form" className="relative mb-6 print:hidden print:m-0">
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open && editingItem && onCancelEdit) {
            onCancelEdit();
          }
        }}
      >
        {!editingItem && (
          <DialogTrigger asChild>
            <Button
              size="sm"
              className="w-full gap-2 print:hidden"
              variant={"brutalist"}
              disabled={!canAdd}
              title={!canAdd ? t("permissionDenied") : ""}
            >
              <PackagePlus size={16} /> {t("title")}
            </Button>
          </DialogTrigger>
        )}
        <DialogContent className={`${attachedTemplate ? 'max-w-[95vw] xl:max-w-7xl max-h-[90vh]' : 'max-w-md max-h-[90vh]'} flex flex-col overflow-hidden`}>
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>
              {editingItem ? t("editItem") : t("title")}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-grow overflow-y-auto pr-2">{combinedContent}</div>
          <DialogFooter className="pt-4 flex flex-row shrink-0 gap-2">
            {attachedTemplate && !editingItem && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleClearTemplate}
              >
                Clear Template
              </Button>
            )}
            <DialogClose asChild>
              <Button variant="outline" className="w-full" onClick={() => {
                if (editingItem && onCancelEdit) {
                  onCancelEdit();
                }
              }}>
                {editingItem ? t("cancel") : tCommon("cancel")}
              </Button>
            </DialogClose>
            <Button
              type="submit"
              form={formId}
              disabled={isSubmitting || !canAdd}
              variant={"brutalist"}
              className="w-full"
              title={!canAdd ? t("permissionDenied") : ""}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("saving")}
                </>
              ) : (
                <>
                  <Plus className="mr-2" size={16} />
                  {editingItem ? t("updateItem") : t("addItem")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TemplateGalleryModal
        journalId={journalId}
        onSelectTemplate={handleSelectTemplate}
        disabled={!canAdd}
        open={isGalleryOpen}
        onOpenChange={(open) => {
          setIsGalleryOpen(open);
          if (!open && templateJustSelectedRef.current) {
            templateJustSelectedRef.current = false;
          } else if (!open && !attachedTemplate) {
            if (formRef.current) formRef.current.resetOnGalleryDismiss();
          }
        }}
      />
    </div>
  );
}
