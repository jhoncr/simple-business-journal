import Link from "next/link";
import Image from "next/image";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Mail, Phone, PencilIcon, Trash2 } from "lucide-react";
import { CreateNewJournal } from "@/app/(auth)/journal/journal-types/create-new-journal";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";
import { httpsCallable } from "firebase/functions";
import { BusinessDetailsType } from "@backend/common/schemas/JournalSchema";
import { functions } from "@/lib/auth_handler";

type ContactInfo = BusinessDetailsType["contactInfo"];

type SubcollectionInfo = {
  subcollection: string;
};

interface InfoCardProps {
  id: string;
  currency?: string;
  contactInfo: ContactInfo;
  logo: string | null;
  journalSubcollections: Record<string, SubcollectionInfo>;
  isAdmin?: boolean;
  onChanged?: () => void;
}

const DEFAULT_TYPE = "estimates";

export function JournalInfoCard({
  id,
  currency,
  contactInfo,
  logo,
  isAdmin = false,
  onChanged,
}: InfoCardProps) {
  const t = useTranslations("journal");
  const tCommon = useTranslations("common");
  const tLogo = useTranslations("logoUpload");
  const { toast } = useToast();

  const [isDeleting, setIsDeleting] = useState(false);

  const initialEditData = {
    title: contactInfo.name,
    details: {
      currency: (currency === "USD" || currency === "BRL"
        ? currency
        : "USD") as "USD" | "BRL",
      contactInfo,
      logo,
    },
  };

  const hasAddress =
    contactInfo.address.street ||
    contactInfo.address.city ||
    contactInfo.address.state ||
    contactInfo.address.zipCode;

  const handleDeleteJournal = async () => {
    setIsDeleting(true);
    try {
      const deleteJournalFn = httpsCallable(functions, "deleteJournal", {
        limitedUseAppCheckTokens: true,
      });
      await deleteJournalFn({ jid: id });
      toast({ title: t("journalDeleted") });
      onChanged?.();
    } catch (error: unknown) {
      console.error("Error deleting journal:", error);
      toast({ title: t("failedToDeleteJournal"), variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const DeleteAction = (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button aria-label={t("deleteJournal")} disabled={isDeleting}>
          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deleteDialogTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("deleteDialogDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeleteJournal}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? t("deleting") : t("deleteJournal")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return (
    <Card className="w-full overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="bg-muted p-2 pb-0">
        {/* Title in the header */}
        <Link href={`/journal?jid=${id}`} className="group">
          <h3
            className="text-lg font-semibold truncate group-hover:text-primary group-hover:underline"
            title={contactInfo.name}
          >
            {contactInfo.name}
          </h3>
        </Link>
      </CardHeader>

      {/* --- Main Info Display --- */}
      <div className="flex justify-between items-start">
        <Link
          href={`/journal?jid=${id}&type=${DEFAULT_TYPE}`}
          className="flex-1 p-4"
        >
          <div className="flex items-start gap-4 my-2">
            {/* Logo and Currency */}
            {(logo || currency) && (
              <div className="flex-shrink-0 w-16 flex flex-col items-center gap-2">
                {logo && (
                  <div className="w-16 h-16 relative bg-muted/50 rounded-md overflow-hidden">
                    {" "}
                    {/* Added background */}
                    <Image
                      src={logo || "/placeholder.svg"}
                      alt={tLogo("companyLogoAlt")}
                      fill
                      className="object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = "/placeholder.svg?height=64&width=64";
                      }}
                    />
                  </div>
                )}
                {currency && (
                  <Badge variant="outline" className="text-xs">
                    {currency}
                  </Badge>
                )}
              </div>
            )}

            {/* Contact Info - without the title */}
            <div className="flex-1 min-w-0">
              <div className="space-y-1 text-sm text-muted-foreground">
                {contactInfo.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5" />
                    <span className="truncate">{contactInfo.email}</span>
                  </div>
                )}

                {contactInfo.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5" />
                    <span>{contactInfo.phone}</span>
                  </div>
                )}

                {hasAddress && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-3.5 w-3.5 mt-0.5" />
                    <div className="flex flex-col text-sm text-muted-foreground justify-start">
                      {contactInfo.address.street && (
                        <div className="text-left">
                          {contactInfo.address.street}
                        </div>
                      )}
                      {(contactInfo.address.city ||
                        contactInfo.address.state ||
                        contactInfo.address.zipCode) && (
                        <span className="text-left">
                          {contactInfo.address.city &&
                            `${contactInfo.address.city}, `}
                          {contactInfo.address.state &&
                            `${contactInfo.address.state} `}
                          {contactInfo.address.zipCode &&
                            contactInfo.address.zipCode}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Link>
        {/* Vertical button menu - only shown for admins */}
        {isAdmin && (
          <div className="flex flex-col space-y-2 ml-auto h-full">
            <div className="p-1 hover:bg-muted rounded">{DeleteAction}</div>

            <CreateNewJournal
              isEdit
              initialData={initialEditData}
              journalId={id}
              onSuccess={onChanged}
              trigger={
                <button
                  type="button"
                  aria-label={tCommon("edit")}
                  className="p-1 hover:bg-muted rounded"
                >
                  <PencilIcon className="h-4 w-4 text-muted-foreground" />
                </button>
              }
            />
          </div>
        )}
      </div>
      {/* </CardHeader> */}
      {/* --- Footer for Subcollection Links --- */}
    </Card>
  );
}
