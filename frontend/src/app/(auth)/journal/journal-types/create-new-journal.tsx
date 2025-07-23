// frontend/src/app/(auth)/journal/journal-types/create-new-journal.tsx
import { useState, useEffect } from "react"; // Added useEffect
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { useForm } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { FilePlus2, Building2 } from "lucide-react"; // Removed Plus import
import { httpsCallable } from "firebase/functions";
import { functions, useAuth } from "@/lib/auth_handler";
import {
  allowedCurrencySchema,
  contactInfoSchema,
} from "@/../../backend/functions/src/common/schemas/common_schemas"; // Use common_schemas for currency/contact
import {
  // JournalGroupSchema, // Removed
  businessDetailsSchema, // Import specific details schema
} from "@/../../backend/functions/src/common/schemas/JournalSchema"; // Update path if needed
import { JOURNAL_TYPES } from "@/../../backend/functions/src/common/const"; // Import JOURNAL_TYPES
import { LogoUpload } from "@/components/LogoUpload";
import { useRouter } from "next/navigation";
import { toast } from "sonner"; // Import toast from sonner
// --- Define Frontend Schema for the Form ---
// This schema matches the structure needed for the 'business' journal type details
const BusinessFormSchema = z.object({
  title: z.string().min(3, "Business name must be at least 3 characters"), // Use title for business name
  details: businessDetailsSchema, // Use the specific details schema
});

type FormValues = z.infer<typeof BusinessFormSchema>;

const getCurrencyOptions = () => {
  return allowedCurrencySchema.options.map((currency) => ({
    value: currency,
    label: currency,
  }));
};

// --- Updated Response Type ---
interface CreateJournalResponse {
  journalId: string; // Expecting journalId now
}

interface CreateNewJournalProps {
  isEdit?: boolean;
  initialData?: FormValues; // Use the new FormValues type
  journalId?: string;
  onClose?: () => void;
  trigger?: React.ReactNode;
}

export function CreateNewJournal({
  isEdit = false,
  initialData, // This needs careful mapping if the source structure differs
  journalId,
  onClose,
  trigger,
}: CreateNewJournalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  // --- Initialize Form ---
  // Setup default values, mapping from potentially different initialData structure if needed
  const defaultValues: FormValues = {
    title: initialData?.title || "",
    details: {
      currency: initialData?.details.currency || "USD",
      contactInfo: initialData?.details.contactInfo || {
        name: initialData?.title || "", // Use business name as default for contact name
        email: null,
        phone: null,
        address: { street: null, city: null, state: null, zipCode: null },
      },
      logo: initialData?.details.logo || null,
    },
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(BusinessFormSchema),
    defaultValues: defaultValues,
  });

  // Effect to reset form when initialData changes (for edit mode)
  useEffect(() => {
    if (isEdit && initialData) {
      form.reset({
        title: initialData.title,
        details: {
          currency: initialData.details.currency,
          contactInfo: initialData.details.contactInfo,
          logo: initialData.details.logo,
        },
      });
    } else if (!isEdit) {
      form.reset(defaultValues); // Reset to defaults when switching to create mode
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData, isEdit, form.reset]);

  // Add this effect to sync the business name and contact name
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "title") {
        // When title changes, update contact name
        form.setValue("details.contactInfo.name", value.title || "");
      }
    });

    return () => subscription.unsubscribe();
  }, [form]);

  const onSubmit = async (data: FormValues) => {
    setPending(true);

    // --- Construct Payload for Backend ---
    // For creation, we need journalType and full details
    // For update, we only send changed fields and the ID
    let payload: any = {
      title: data.title, // Use the title from the form
      details: data.details, // Send the whole details object
    };

    if (isEdit && journalId) {
      payload.id = journalId;
      // Optionally: Only send changed fields for updates?
      // This requires comparing 'data' with 'initialData'
    } else {
      // Add journalType for creation
      payload.journalType = JOURNAL_TYPES.BUSINESS;
    }

    console.log("Payload:", payload);

    // --- Call Correct Backend Function ---
    const functionName = isEdit ? "updateJournal" : "createJournal";
    const callable = httpsCallable(functions, functionName, {
      limitedUseAppCheckTokens: true,
    });

    try {
      const result = await callable(payload);
      console.log(`${functionName} successful:`, result.data);

      toast.success(
        `Business "${data.title}" has been ${
          isEdit ? "updated" : "created"
        } successfully.`,
      );

      form.reset(defaultValues); // Reset form to defaults after success
      setIsOpen(false);
      if (onClose) onClose();

      // --- Redirect on Creation ---
      if (!isEdit && result.data) {
        const response = result.data as CreateJournalResponse;
        router.push(`/journal?jid=${response.journalId}`); // Use the returned journalId
      } else if (isEdit) {
        // Optional: Force refresh or update local state if needed after edit
        router.refresh(); // Simple way to refresh data on the current page
      }
    } catch (error: any) {
      console.error(`${functionName} failed:`, error);
      toast.error(
        `Error ${isEdit ? "Updating" : "Creating"} Business: ${
          error.message || "An unexpected error occurred."
        }`,
      );
    } finally {
      setPending(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen === false && !isEdit) {
      // Only reset fully if creating
      form.reset(defaultValues);
    } else if (nextOpen === true && isEdit && initialData) {
      // Reset to initialData when opening edit
      form.reset({
        title: initialData.title,
        details: {
          currency: initialData.details.currency,
          contactInfo: initialData.details.contactInfo,
          logo: initialData.details.logo,
        },
      });
    }
    setIsOpen(nextOpen);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-content h-content print:hidden">
            <Button variant="brutalist" className="text-sm flex items-center">
              <Building2 className="pr-2" />
              New Business
            </Button>
          </div>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Business" : "New Business"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update your business information."
              : "Create a new business journal to manage estimates, inventory, and cash flow."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          {/* --- Use form.handleSubmit --- */}
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* --- Business Name (Title) --- */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <FormDescription className="text-start col-span-1">
                      Name
                    </FormDescription>
                    <FormControl className="col-span-3">
                      <Input placeholder="Business Name" {...field} />
                    </FormControl>
                  </div>
                  <FormMessage className="col-start-2 col-span-3" />{" "}
                  {/* Adjust message position */}
                </FormItem>
              )}
            />

            {/* --- Logo --- */}
            <FormField
              control={form.control}
              name="details.logo"
              render={({ field }) => (
                <FormItem>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <FormDescription className="text-start">
                      Logo
                    </FormDescription>
                    <div className="col-span-3">
                      <FormControl>
                        {/* Pass field.value and field.onChange */}
                        <LogoUpload
                          logo={field.value}
                          setLogo={(newLogo) => field.onChange(newLogo)}
                        />
                      </FormControl>
                    </div>
                  </div>
                  <FormMessage className="col-start-2 col-span-3" />
                </FormItem>
              )}
            />

            {/* --- Currency --- */}
            <FormField
              control={form.control}
              name="details.currency"
              render={({ field }) => (
                <FormItem>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <FormDescription className="text-start">
                      Currency
                    </FormDescription>
                    <FormControl className="col-span-3">
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={field.value} // Use field.value
                        onChange={field.onChange} // Use field.onChange
                        required
                      >
                        {getCurrencyOptions().map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                  </div>
                  <FormMessage className="col-start-2 col-span-3" />
                </FormItem>
              )}
            />

            {/* --- Contact Information Fields --- */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-medium text-sm col-span-4 mb-2">
                Contact Information
              </h3>
              {/* Email */}
              <FormField
                control={form.control}
                name="details.contactInfo.email"
                render={({ field }) => (
                  <FormItem>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <FormDescription className="text-start">
                        Email
                      </FormDescription>
                      <FormControl className="col-span-3">
                        <Input
                          placeholder="Email address"
                          type="email"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                    </div>
                    <FormMessage className="col-start-2 col-span-3" />
                  </FormItem>
                )}
              />
              {/* Phone */}
              <FormField
                control={form.control}
                name="details.contactInfo.phone"
                render={({ field }) => (
                  <FormItem>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <FormDescription className="text-start">
                        Phone
                      </FormDescription>
                      <FormControl className="col-span-3">
                        <Input
                          placeholder="Phone number"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                    </div>
                    <FormMessage className="col-start-2 col-span-3" />
                  </FormItem>
                )}
              />
              {/* Street */}
              <FormField
                control={form.control}
                name="details.contactInfo.address.street"
                render={({ field }) => (
                  <FormItem>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <FormDescription className="text-start">
                        Street
                      </FormDescription>
                      <FormControl className="col-span-3">
                        <Input
                          placeholder="Street address"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                    </div>
                    <FormMessage className="col-start-2 col-span-3" />
                  </FormItem>
                )}
              />
              {/* City, State, Zip */}
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="details.contactInfo.address.city"
                  render={({ field }) => (
                    <FormItem>
                      <FormDescription className="text-start">
                        City
                      </FormDescription>
                      <FormControl>
                        <Input {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="details.contactInfo.address.state"
                  render={({ field }) => (
                    <FormItem>
                      <FormDescription className="text-start">
                        State
                      </FormDescription>
                      <FormControl>
                        <Input {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="details.contactInfo.address.zipCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormDescription className="text-start">
                        ZIP
                      </FormDescription>
                      <FormControl>
                        <Input
                          placeholder="ZIP Code"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={pending} variant={"brutalist"}>
                <FilePlus2 className="pr-2" />
                {pending
                  ? isEdit
                    ? "Saving..."
                    : "Creating..."
                  : isEdit
                  ? "Save Changes"
                  : "Create Business"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
