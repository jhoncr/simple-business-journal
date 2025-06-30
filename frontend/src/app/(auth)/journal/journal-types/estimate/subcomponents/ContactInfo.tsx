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
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Edit2, Mail, MapPin, Phone, User, X, AtSignIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  contactInfoSchema,
  contactInfoSchemaType,
} from "@/../../backend/functions/src/common/schemas/common_schemas";

export interface ContactInfoRef {
  validate: () => Promise<boolean>;
}

interface ContactInfoProps {
  info: contactInfoSchemaType;
  setInfo: (info: contactInfoSchemaType) => void;
  onSave?: (updates: any) => void;
}

// Improved ContactSummary layout
const ContactSummary = ({ info }: { info: contactInfoSchemaType }) => (
  <div className="flex flex-wrap justify-between items-start gap-4 flex-grow">
    {/* Name and company info */}
    <div className="flex flex-col">
      <div className="flex items-center space-x-2">
        <User className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold">{info.name || "Not set"}</h2>
      </div>

      {/* Address below name */}
      {info.address?.street && ( // Add optional chaining to safely access address properties
        <div className="mt-2 text-sm text-muted-foreground">
          <div className="flex items-center space-x-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-wrap gap-2">
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
    <div className="flex flex-wrap justify-between items-center gap-4 sm:flex-col sm:items-end grow">
      <div className="flex items-center space-x-2">
        <Phone className="h-4 w-4 text-muted-foreground" />
        <a
          href={`tel:${info.phone}`}
          className="text-sm text-muted-foreground hover:text-primary"
        >
          {info.phone || "Not set"}
        </a>
      </div>
      <div className="flex items-center space-x-2">
        <Mail className="h-4 w-4 text-muted-foreground" />
        <a
          href={`mailto:${info.email}`}
          className="text-sm text-muted-foreground hover:text-primary"
        >
          {info.email || "Not set"}
        </a>
      </div>
    </div>
  </div>
);

export const ContactInfo = forwardRef<ContactInfoRef, ContactInfoProps>(
  ({ info, setInfo, onSave }, ref) => {
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
          onSave({ customer: data });
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
      <Card className="relative">
        <CardHeader className="flex items-center justify-between pr-4 pb-2 pt-2">
          {isEditing && (
            <div className="flex flex-row-reverse items-center justify-start space-x-2 w-full  print:hidden">
              <Button
                variant="brutalist"
                size="icon"
                onClick={handleCancel}
                disabled={!contactInfoSchema.safeParse(info).success}
                aria-label="Cancel editing"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-4 pt-0">
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
                            placeholder="John Doe"
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
                            placeholder="(555) 555-5555"
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
                      <div className="text-sm font-medium">Street Address</div>
                      <FormControl>
                        <Input
                          placeholder="123 Main St"
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
                        <div className="text-sm font-medium">City</div>
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
                        <div className="text-sm font-medium">State</div>
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
                        <div className="text-sm font-medium">ZIP Code</div>
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
                    Cancel
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
                    {isSubmitting ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            <div className="space-x-4 print:hidden flex flex-row justify-between items-center">
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
