"use client";

import { useState, useEffect, useCallback } from "react";
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
  FormMessage,
} from "@/components/ui/form";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";

import { useForm } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Copy, Link, Plus, UserPlus2, UserX } from "lucide-react";
import { httpsCallable } from "firebase/functions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UserSchemaType,
  AccessMap,
  pendingAccessSchemaType,
  ROLES,
} from "@backend/common/schemas/common_schemas";
import { functions } from "@/lib/auth_handler";

import { SharableLink } from "@/components/ui/sharable-link";
// Schema will be created inside component to use translations

type AccessList = { email: string; role: string; is_pending?: boolean };

// Resolve hostname dynamically from window origin, env var, or dev fallback
export function getAppOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000";
  }
  return "";
}

export function AddContributers({
  journalId,
  access,
  pendingAccess,
  externalOpen,
  onExternalOpenChange,
}: {
  journalId: string | undefined;
  access: AccessMap;
  pendingAccess: pendingAccessSchemaType;
  /** When provided, the dialog open state is controlled externally (used by mobile dropdown). */
  externalOpen?: boolean;
  /** Callback for externally controlled open state changes. */
  onExternalOpenChange?: (open: boolean) => void;
}) {
  const t = useTranslations("contributors");

  // Create schema with translations
  const schema = z
    .object({
      email: z.string().email({ message: t("validEmail") }),
      role: z.enum(ROLES),
    })
    .strict();

  type PersonType = z.infer<typeof schema>;

  const [internalOpen, setInternalOpen] = useState(false);
  const [people, setPeople] = useState([] as AccessList[]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState<string>("");

  useEffect(() => {
    setOrigin(getAppOrigin());
  }, []);

  // Support external or internal control
  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;
  const setIsOpen = useCallback(
    (open: boolean) => {
      if (onExternalOpenChange) {
        onExternalOpenChange(open);
      }
      setInternalOpen(open);
    },
    [onExternalOpenChange],
  );

  const form = useForm<PersonType>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", role: "viewer" },
  });

  // Sync people list whenever dialog opens (handles both internal trigger and externalOpen)
  useEffect(() => {
    if (!isOpen) return;
    const activePeople = Object.values(access || {}).map((x: UserSchemaType) => ({
      email: x.email,
      role: x.role,
      is_pending: false,
    }));
    const pendingPeople =
      (pendingAccess &&
        Object.entries(pendingAccess).map(([k, v]) => ({
          email: k.replace(/,/g, "."),
          role: v,
          is_pending: true,
        }))) ||
      [];
    setPeople(activePeople.concat(pendingPeople));
    setError(null);
    form.reset();
  }, [isOpen, access, pendingAccess, form]);

  const callAddContributor = async (data: {
    email: string;
    role: string;
    operation: "add" | "remove";
    jid: string | undefined;
  }) => {
    setPending(true);
    setError(null);
    try {
      const addContributor = httpsCallable(functions, "addContributor", {
        limitedUseAppCheckTokens: true,
      });
      await addContributor(data);
      return true;
    } catch (error: unknown) {
      console.error("Failed to update contributors:", error);
      const errObj = error as { code?: string; message?: string } | null;
      if (errObj?.code === "functions/permission-denied") {
        setError(t("noPermissionModify"));
      } else if (errObj?.code === "functions/invalid-argument") {
        setError(t("invalidContributorInfo"));
      } else {
        setError(errObj?.message || t("errorUpdatingContributors"));
      }
      return false;
    } finally {
      setPending(false);
    }
  };

  const onClose = useCallback(() => {
    form.reset();
    setIsOpen(false);
  }, [form, setIsOpen]);

  const onOpenHandler = (open: boolean) => {
    setIsOpen(open);
  };

  const onAddClick = async () => {
    const isValid = await form.trigger();
    if (!isValid) return;

    const email = form.getValues().email;
    const role = form.getValues().role;
    const cur = people.find((person) => person.email === email);
    if (cur) {
      if (role === cur.role) {
        setError(t("emailAlreadyInList"));
        return;
      }
      if (cur.role === "admin") {
        setError(t("cannotChangeAdminRole"));
        return;
      }
    }

    try {
      const result = await callAddContributor({
        email,
        role,
        operation: "add",
        jid: journalId,
      });
      if (result) {
        setPeople((prevPeople) => {
          const exists = prevPeople.some((p) => p.email === email);
          if (exists) {
            return prevPeople.map((p) =>
              p.email === email ? { ...p, role } : p,
            );
          }
          return [...prevPeople, { email, role, is_pending: true }];
        });
        form.reset();
        setError(null);
      }
    } catch (err) {
      console.error("Error adding contributor:", err);
      setError(t("failedToAdd"));
    }
  };

  const onClickRemove = async (idx: number) => {
    const target = people[idx];
    if (!target) return;

    try {
      const result = await callAddContributor({
        email: target.email,
        role: target.role,
        operation: "remove",
        jid: journalId,
      });
      if (result) {
        setPeople((prev) => prev.filter((_, index) => index !== idx));
      } else {
        setError(t("failedToRemove"));
      }
    } catch (err) {
      console.error("Error removing contributor:", err);
      setError(t("failedToRemove"));
    }
  };

  // Generate the share link dynamically from runtime origin
  const baseOrigin = origin || getAppOrigin();
  const shareLink =
    journalId && baseOrigin
      ? `${baseOrigin}/share?journal=${journalId}`
      : journalId
        ? `/share?journal=${journalId}`
        : "";

  return (
    <Dialog open={isOpen} onOpenChange={onOpenHandler}>
      {/* Hide trigger when controlled externally (mobile dropdown opens the dialog) */}
      {externalOpen === undefined && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="flex items-center gap-2 h-9" disabled={!journalId}>
            <UserPlus2 size={16} />
            <span className="hidden lg:inline-block">{t("title")}</span>
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto" onCloseAutoFocus={onClose}>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <div className="grid grid-cols-6 gap-2 -mb-5 -mt-2">
            <div className="col-span-3">
              <Label htmlFor="email">{t("email")}</Label>
            </div>
            <div className="col-span-2">
              <Label htmlFor="role">{t("role")}</Label>
            </div>
          </div>
          <form className="space-y-6">
            <div className="grid grid-cols-6 gap-2">
              <div className="col-span-3">
                <FormField
                  control={form.control}
                  name={"email"}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          onChange={(e) => {
                            field.onChange(e.target.value);
                          }}
                          value={field.value}
                          id={field.name}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="col-span-2">
                <FormField
                  control={form.control}
                  name={"role"}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          defaultValue={field.value}
                        >
                          <SelectTrigger id="role">
                            <SelectValue placeholder={t("selectRole")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">
                              {t("roles.admin")}
                            </SelectItem>
                            <SelectItem value="editor">
                              {t("roles.editor")}
                            </SelectItem>
                            <SelectItem value="staff">
                              {t("roles.staff")}
                            </SelectItem>
                            <SelectItem value="viewer">
                              {t("roles.viewer")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button
                type="button"
                id="add-new-contributor"
                variant="outline"
                size="icon"
                onClick={onAddClick}
                aria-label={t("addNewContributor")}
                disabled={pending}
              >
                <Plus />
              </Button>
            </div>
          </form>
          {/* Display error message */}
          {error && (
            <div
              className="bg-destructive text-destructive-foreground px-4 py-3 rounded relative mt-2 text-sm"
              role="alert"
            >
              <span className="block sm:inline">{error}</span>
            </div>
          )}
          {/* People list with improved overflow handling */}
          {people.length > 0 && (
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
              {people.map((person, idx) => (
                <div
                  className="flex items-center justify-between border-b"
                  key={`p-${idx}`}
                >
                  <div className="max-w-[80%] overflow-hidden">
                    <p className="truncate">{person.email}</p>
                    <p className="text-xs text-ellipsis">
                      {`${person.is_pending ? t("pending") + ":" : ""} ${t(
                        `roles.${person.role}`,
                      )}`}
                    </p>
                  </div>

                  <Button
                    key={`rm-${idx}`}
                    variant="outline"
                    size="icon"
                    type="button"
                    aria-label={t("remove")}
                    className={
                      person.role === "admin" && !person.is_pending
                        ? "hidden"
                        : "flex-shrink-0 items-center justify-center bg-accent mb-1"
                    }
                    onClick={() => onClickRemove(idx)}
                    disabled={pending}
                  >
                    <UserX />
                    <span className="sr-only">{t("remove")}</span>
                  </Button>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            {/* Share link section  */}
            <div className="flex flex-col space-y-4 w-full">
              {journalId && (
                <SharableLink link={shareLink} maxDisplayLength={30} />
              )}
              <Button
                type="button"
                variant={"outline"}
                onClick={() => setIsOpen(false)}
              >
                {t("close")}
              </Button>
            </div>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
