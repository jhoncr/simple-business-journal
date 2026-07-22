"use client";

import React, { useState, useImperativeHandle, forwardRef } from "react";
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  Form,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Edit2, Mail, MapPin, Phone, User, X, AtSignIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  contactInfoSchema,
  contactInfoSchemaType,
} from "@backend/common/schemas/common_schemas";
import { useTranslations } from "next-intl";

export interface ContactInfoRef {
  validate: () => Promise<boolean>;
}

interface ContactInfoProps {
  info: contactInfoSchemaType;
  setInfo: (info: contactInfoSchemaType) => void;
  onSave?: (updates: any) => void;
  title?: string;
}

// Improved ContactSummary layout
const ContactSummary = ({ info }: { info: contactInfoSchemaType }) => {
  const t = useTranslations("contactInfo");
  return (
    <div className="flex flex-wrap justify-between items-start gap-2 flex-grow">
      {/* Name and company info */}
      <div className="flex flex-col">
        <div className="flex items-center space-x-2">
          <User className="h-4 w-4 text-primary print:h-4 print:w-4" />
          <h2 className="text-base font-bold print:text-sm">
            {info.name || t("notSet")}
          </h2>
        </div>

        {/* Address below name */}
        {info.address?.street && ( // Add optional chaining to safely access address properties
          <div className="mt-1 text-2xs text-muted-foreground print:text-2xs">
            <div className="flex items-center space-x-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div className="flex flex-wrap gap-x-1">
                <span>{info.address.street}</span>
                <div>
                  {info.address.city}, {info.address.state}{" "}
                  {info.address.zipCode}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Contact details on right side */}
      <div className="flex flex-col md:items-end space-y-1 text-2xs">
        <div className="flex items-center space-x-1">
          <Phone className="h-4 w-4 text-muted-foreground" />
          <a
            href={`tel:${info.phone}`}
            className="text-muted-foreground hover:text-primary print:text-2xs"
          >
            {info.phone || t("notSet")}
          </a>
        </div>
        <div className="flex items-center space-x-1">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <a
            href={`mailto:${info.email}`}
            className="text-muted-foreground hover:text-primary print:text-2xs"
          >
            {info.email || t("notSet")}
          </a>
        </div>
      </div>
    </div>
  );
};

export const ContactInfo = forwardRef<ContactInfoRef, ContactInfoProps>(
  ({ info, setInfo, onSave, title }, ref) => {
    const t = useTranslations("contactInfo");
    const tCommon = useTranslations("common");
    const [isEditing, setIsEditing] = useState(!info.name);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<contactInfoSchemaType>({
      resolver: zodResolver(contactInfoSchema),
      defaultValues: info,
    });

    const handleCancel = () => {
      form.reset(info);
      setIsEditing(false);
    };

    const handleSubmit = async (data: contactInfoSchemaType) => {
      try {
        setIsSubmitting(true);
        setInfo(data);
        if (onSave) {
          onSave(data);
        }
        setIsEditing(false);
      } catch (error) {
        console.error("Error submitting form:", error);
      } finally {
        setIsSubmitting(false);
      }
    };

    useImperativeHandle(ref, () => ({
      validate: () => form.trigger(),
    }));

    return (
      <Card className="relative print:border-none print:shadow-none">
        {(title || isEditing) && (
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-2 print:p-0">
            {title && <CardTitle className="text-base font-semibold print:text-sm">{title}</CardTitle>}
            {isEditing && (
              <Button
                variant="brutalist"
                size="icon"
                onClick={handleCancel}
                disabled={!contactInfoSchema.safeParse(info).success}
                aria-label="Cancel editing"
                className="print:hidden h-8 w-8 -my-2"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </CardHeader>
        )}
        <CardContent className={isEditing ? "p-4 pt-0 print:p-0" : "p-4 pt-0 print:p-0"}>
          <div className="hidden print:block">
            <ContactSummary info={info} />
          </div>
          {isEditing ? (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleSubmit)}
                className="space-y-4 print:hidden"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <div className="relative">
                        <FormControl>
                          <Input
                            className="peer ps-9"
                            placeholder={t("namePlaceholder")}
                            {...field}
                          />
                        </FormControl>
                        <div className="text-muted-foreground/80 pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 peer-disabled:opacity-50">
                          <User size={16} aria-hidden="true" />
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <div className="relative">
                        <FormControl>
                          <Input
                            className="peer ps-9"
                            placeholder="email@example.com"
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                          />
                        </FormControl>
                        <div className="text-muted-foreground/80 pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 peer-disabled:opacity-50">
                          <AtSignIcon size={16} aria-hidden="true" />
                        </div>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <div className="relative">
                        <FormControl>
                          <Input
                            className="peer ps-9"
                            placeholder={t("phonePlaceholder")}
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                          />
                        </FormControl>
                        <div className="text-muted-foreground/80 pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 peer-disabled:opacity-50">
                          <Phone size={16} aria-hidden="true" />
                        </div>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address.street"
                  render={({ field }) => (
                    <FormItem>
                      <div className="text-sm font-medium">
                        {t("streetAddress")}
                      </div>
                      <FormControl>
                        <Input
                          placeholder={t("streetPlaceholder")}
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="address.city"
                    render={({ field }) => (
                      <FormItem>
                        <div className="text-sm font-medium">{t("city")}</div>
                        <FormControl>
                          <Input
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="address.state"
                    render={({ field }) => (
                      <FormItem>
                        <div className="text-sm font-medium">{t("state")}</div>
                        <FormControl>
                          <Input
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="address.zipCode"
                    render={({ field }) => (
                      <FormItem>
                        <div className="text-sm font-medium">
                          {t("zipCode")}
                        </div>
                        <FormControl>
                          <Input
                            placeholder="12345"
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleCancel}
                    disabled={
                      isSubmitting ||
                      form.formState.isSubmitting ||
                      !contactInfoSchema.safeParse(info).success
                    }
                  >
                    {tCommon("cancel")}
                  </Button>
                  <Button
                    type="submit"
                    // disabled={
                    //   !form.formState.isValid ||
                    //   isSubmitting ||
                    //   form.formState.isSubmitting
                    // }
                    variant={"brutalist"}
                    aria-label="Save changes"
                  >
                    {isSubmitting ? t("saving") : t("saveChanges")}
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            <div className="space-x-4 print:hidden flex flex-row justify-between items-top">
              <ContactSummary info={info} />
              <Button
                variant="brutalist"
                size="sm"
                onClick={() => {
                  form.reset(info);
                  setIsEditing(true);
                }}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  },
);

ContactInfo.displayName = "ContactInfo";
