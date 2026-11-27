// frontend/src/app/(auth)/journal/journal-types/create-new-journal.tsx
import { useState, useEffect, useMemo } from "react";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { useForm } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { FilePlus2, Building2 } from "lucide-react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/auth_handler";
import { allowedCurrencySchema } from "@backend/common/schemas/common_schemas";
import { businessDetailsSchema } from "@backend/common/schemas/JournalSchema";
import { JOURNAL_TYPES } from "@backend/common/const";
import { LogoUpload } from "@/components/LogoUpload";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";

const createBusinessFormSchema = (minLengthMessage: string) =>
  z.object({
    title: z.string().min(3, minLengthMessage),
    details: businessDetailsSchema,
  });

type FormValues = {
  title: string;
  details: z.infer<typeof businessDetailsSchema>;
};

const getCurrencyOptions = () => {
  return allowedCurrencySchema.options.map((currency) => ({
    value: currency,
    label: currency,
  }));
};

interface CreateJournalResponse {
  journalId: string;
}

interface CreateNewJournalProps {
  isEdit?: boolean;
  initialData?: FormValues;
  journalId?: string;
  onClose?: () => void;
  onSuccess?: () => void;
  trigger?: React.ReactNode;
}

export function CreateNewJournal({
  isEdit = false,
  initialData,
  journalId,
  onClose,
  onSuccess,
  trigger,
}: CreateNewJournalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const t = useTranslations("newJournal");
  const { toast } = useToast();

  const businessFormSchema = useMemo(
    () => createBusinessFormSchema(t("businessNameMinLength")),
    [t],
  );

  const defaultValues: FormValues = useMemo(
    () => ({
      title: initialData?.title || "",
      details: {
        currency: initialData?.details.currency || "USD",
        contactInfo: initialData?.details.contactInfo || {
          name: initialData?.title || "",
          email: null,
          phone: null,
          address: { street: null, city: null, state: null, zipCode: null },
        },
        logo: initialData?.details.logo || null,
      },
    }),
    [initialData],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(businessFormSchema),
    defaultValues,
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
      form.reset(defaultValues);
    }
  }, [initialData, isEdit, form, defaultValues]);

  // Sync the business name and contact name
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "title") {
        form.setValue("details.contactInfo.name", value.title || "");
      }
    });

    return () => subscription.unsubscribe();
  }, [form]);

  const onSubmit = async (data: FormValues) => {
    setPending(true);

    const payload: Record<string, unknown> = {
      title: data.title,
      details: data.details,
    };

    if (isEdit && journalId) {
      payload.jid = journalId;
    } else {
      payload.journalType = JOURNAL_TYPES.BUSINESS;
    }

    const functionName = isEdit ? "updateJournal" : "createJournal";
    const callable = httpsCallable(functions, functionName, {
      limitedUseAppCheckTokens: true,
    });

    try {
      const result = await callable(payload);

      toast({
        title: t("successMessage", {
          businessName: data.title,
          action: isEdit ? t("updated") : t("created"),
        }),
      });

      form.reset(defaultValues);
      setIsOpen(false);
      onClose?.();
      onSuccess?.();

      if (!isEdit && result.data) {
        const response = result.data as CreateJournalResponse;
        router.push(`/journal?jid=${response.journalId}`);
      }
    } catch (error: unknown) {
      console.error(`${functionName} failed:`, error);
      const message =
        error instanceof Error ? error.message : t("unexpectedError");
      toast({
        title: t("errorMessage", {
          action: isEdit ? t("updating") : t("creatingVerb"),
          error: message || t("unexpectedError"),
        }),
        variant: "destructive",
      });
    } finally {
      setPending(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen === false && !isEdit) {
      form.reset(defaultValues);
    } else if (nextOpen === true && isEdit && initialData) {
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
              {t("newBusiness")}
            </Button>
          </div>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("editBusiness") : t("newBusiness")}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? t("updateInfo") : t("createNewBusinessJournal")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Business Name (Title) */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <FormLabel className="text-start col-span-1">
                      {t("name")}
                    </FormLabel>
                    <FormControl className="col-span-3">
                      <Input placeholder={t("businessName")} {...field} />
                    </FormControl>
                  </div>
                  <FormMessage className="col-start-2 col-span-3" />
                </FormItem>
              )}
            />

            {/* Logo */}
            <FormField
              control={form.control}
              name="details.logo"
              render={({ field }) => (
                <FormItem>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <FormLabel className="text-start">{t("logo")}</FormLabel>
                    <div className="col-span-3">
                      <FormControl>
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

            {/* Currency */}
            <FormField
              control={form.control}
              name="details.currency"
              render={({ field }) => (
                <FormItem>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <FormLabel className="text-start">
                      {t("currency")}
                    </FormLabel>
                    <FormControl className="col-span-3">
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={field.value}
                        onChange={field.onChange}
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

            {/* Contact Information Fields */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-medium text-sm col-span-4 mb-2">
                {t("contactInformation")}
              </h3>
              {/* Email */}
              <FormField
                control={form.control}
                name="details.contactInfo.email"
                render={({ field }) => (
                  <FormItem>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <FormLabel className="text-start">
                        {t("email")}
                      </FormLabel>
                      <FormControl className="col-span-3">
                        <Input
                          placeholder={t("emailAddress")}
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
                      <FormLabel className="text-start">
                        {t("phone")}
                      </FormLabel>
                      <FormControl className="col-span-3">
                        <Input
                          placeholder={t("phoneNumber")}
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
                      <FormLabel className="text-start">
                        {t("street")}
                      </FormLabel>
                      <FormControl className="col-span-3">
                        <Input
                          placeholder={t("streetAddress")}
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
                      <FormLabel className="text-start">
                        {t("city")}
                      </FormLabel>
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
                      <FormLabel className="text-start">
                        {t("state")}
                      </FormLabel>
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
                      <FormLabel className="text-start">{t("zip")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("zipPlaceholder")}
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
                    ? t("saving")
                    : t("creating")
                  : isEdit
                  ? t("saveChanges")
                  : t("createBusiness")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
