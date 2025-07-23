import Link from "next/link";
import Image from "next/image";
import { Card, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Mail,
  Phone,
  ExternalLink,
  PencilIcon,
  Trash2,
  GripVertical,
} from "lucide-react"; // Added GripVertical
import { CreateNewJournal } from "@/app/(auth)/journal/journal-types/create-new-journal";
import { getJournalIcon } from "@/app/(auth)/journal/journal-types/config"; // Keep if used for icons
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
import { toast } from "@/components/ui/sonner"; // Import toast from sonner
import { getFunctions, httpsCallable } from "firebase/functions";
import { useRouter } from "next/navigation";
// --- Import specific types ---
import { BusinessDetailsType } from "@/../../backend/functions/src/common/schemas/JournalSchema";
import { functions } from "@/lib/auth_handler"; // Use configured functions

// --- Update Types for Props ---
type Address = BusinessDetailsType["contactInfo"]["address"]; // Use nested type
type ContactInfo = BusinessDetailsType["contactInfo"];

// --- Add subcollection info prop type ---
type SubcollectionInfo = {
  subcollection: string; // e.g., "cashflow_entries"
  // Add other relevant info like display name, icon?
  // displayName?: string;
  // icon?: React.ReactNode;
};

interface InfoCardProps {
  id: string; // Journal ID is required
  currency?: string; // Optional for non-business types
  contactInfo: ContactInfo; // Required, structure might vary slightly by type
  logo: string | null;
  // --- Updated Prop: journalSubcollections ---
  // Pass the config for subcollections relevant to *this* journal
  journalSubcollections: Record<string, SubcollectionInfo>;
}

export function JournalInfoCard({
  id,
  currency,
  contactInfo,
  logo,
  journalSubcollections,
}: InfoCardProps) {
  // --- State and Hooks ---
  const [isDeleting, setIsDeleting] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const router = useRouter();

  console.log("journalSubcollections", journalSubcollections);
  // --- Prepare Data for Edit Form ---
  // This assumes the card is primarily for Business type for editing
  // Adjust if editing different types directly from the card
  const initialEditData = {
    title: contactInfo.name, // Use contact name as title for form
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

  // --- Use correct backend function name ---
  const handleDeleteJournal = async () => {
    setIsDeleting(true); // Set pending state
    try {
      // Call deleteJournal function
      const deleteJournalFn = httpsCallable(functions, "deleteJournal"); // Use correct name
      await deleteJournalFn({ journalId: id }); // Pass journalId
      toast.info("Journal deleted");
      router.push("/"); // Navigate home after delete
      router.refresh(); // Force refresh
    } catch (error: any) {
      console.error("Error deleting journal:", error);
      toast.error("Failed to delete the journal. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  // --- Get Subcollection Display Names (Example) ---
  // You might want a mapping from subcollection key ('cashflow') to display name ('Cash Flow')
  const getSubcollectionDisplayName = (key: string): string => {
    const nameMap: Record<string, string> = {
      cashflow: "Cash Flow",
      inventory: "Inventory",
      estimates: "Estimates",
      naps: "Naps",
      diapers: "Diapers",
      feeds: "Feeds",
      growth: "Growth",
    };
    return nameMap[key] || key.charAt(0).toUpperCase() + key.slice(1); // Default capitalization
  };

  const DeleteAction = (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button aria-label="Delete journal" disabled={isDeleting}>
          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action will mark the journal as deleted. This journal and all
            its entries will no longer be accessible.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeleteJournal}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Deleting..." : "Delete Journal"}
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
                    alt="Logo"
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
        {/* Vertical button menu - moved from header to body */}
        <div className="flex flex-col space-y-2 ml-auto h-full">
          <div className="p-1 hover:bg-muted rounded">{DeleteAction}</div>

          <CreateNewJournal
            isEdit
            initialData={initialEditData as any}
            journalId={id}
            onClose={() => setIsEditing(false)}
            trigger={
              <button
                onClick={() => setIsEditing(true)}
                aria-label="Edit"
                className="p-1 hover:bg-muted rounded"
              >
                <PencilIcon className="h-4 w-4 text-muted-foreground" />
              </button>
            }
          />
        </div>
      </div>
      {/* </CardHeader> */}
      {/* --- Footer for Subcollection Links --- */}
      {Object.keys(journalSubcollections).length > 0 && (
        // Link the entire footer to the main journal page for simplicity
        <CardFooter className="border-t flex flex-wrap justify-start p-3 mt-2 bg-secondary/50 hover:bg-secondary/80 transition-colors cursor-pointer">
          <span className="text-xs font-medium mr-2 text-secondary-foreground/80">
            Sections:
          </span>
          {Object.entries(journalSubcollections).map(([key, info]) => (
            <Link href={`/journal?jid=${id}&type=${key}`} key={key}>
              <Badge variant="secondary" className="mr-1 mb-1 text-xs">
                {/* Optionally add icon: getJournalIcon(key) */}
                {key}
              </Badge>
            </Link>
          ))}
        </CardFooter>
      )}
    </Card>
  );
}
