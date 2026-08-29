import { useState } from "react";
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

// Define the hostname for sharing links
const HOSTNAME =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://nm.j3cordeiro.com";

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

  // Support external or internal control
  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;
  const setIsOpen = (open: boolean) => {
    if (onExternalOpenChange) {
      onExternalOpenChange(open);
    }
    setInternalOpen(open);
  };

  const form = useForm<PersonType>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", role: "viewer" },
  });

  const callAddContributor = async (data: any) => {
    setPending(true);
    setError(null);
    try {
      const addContributor = httpsCallable(functions, "addContributor", {
        limitedUseAppCheckTokens: true,
      });
      const result = await addContributor(data);
      console.log("Successfully updated contributors");
      return true;
    } catch (error: any) {
      console.error("Failed to update contributors:", error);
      // Extract error message for display
      const errorMessage = error.message || t("errorUpdatingContributors");
      setError(errorMessage);
      // Handle specific error codes if the Firebase function returns them
      if (error.code === "functions/permission-denied") {
        setError(t("noPermissionModify"));
      } else if (error.code === "functions/invalid-argument") {
        setError(t("invalidContributorInfo"));
      }
      return false;
    } finally {
      setPending(false);
    }
  };

  const onClose = () => {
    form.reset();
    setIsOpen(false);
  };

  const onOpenHandler = (open: boolean) => {
    if (open) {
      const a = Object.values(access).map((x: UserSchemaType) => ({
        email: x.email,
        role: x.role,
        is_pending: false,
      }));
      const p =
        (pendingAccess &&
          Object.entries(pendingAccess).map(([k, v]) => ({
            email: k.replace(/,/g, "."),
            role: v,
            is_pending: true,
          }))) ||
        [];
      setPeople(a.concat(p));
      form.reset();
    }
    setIsOpen(open);
  };

  const onAddClick = async () => {
    form.trigger().then(async (isValid) => {
      if (isValid) {
        const email = form.getValues().email;
        const role = form.getValues().role;
        // Check if the email is already in the list
        const cur = people.find((person) => person.email === email);
        if (cur) {
          if (role === cur.role) {
            setError(t("emailAlreadyInList"));
            return;
          }
          if (cur.role == "admin") {
            setError(t("cannotChangeAdminRole"));
            return;
          }
        }
        // Submit changes immediately
        await callAddContributor({
          email,
          role: form.getValues().role,
          operation: "add",
          jid: journalId,
        })
          .then((result) => {
            if (result) {
              const newPerson = {
                email,
                role: form.getValues().role,
                is_pending: cur ? cur.is_pending : true,
              };
              setPeople((prevPeople) => [...prevPeople, newPerson]);
              form.reset();
              setError(null);
              console.log("Contributor added successfully");
              return true;
            }
          })
          .catch((error) => {
            console.error("Error adding contributor:", error);
            setError(t("failedToAdd"));
          });
      }
    });
  };

  const onClickRemove = async (idx: number) => {
    const updatedPeople = people.filter((person, index) => index !== idx);

    // Submit changes immediately
    await callAddContributor({
      email: people[idx].email,
      role: people[idx].role,
      operation: "remove",
      jid: journalId,
    })
      .then((result) => {
        if (result) {
          setPeople(updatedPeople);
          console.log("Contributor removed successfully");
        } else {
          setError(t("failedToRemove"));
        }
      })
      .catch((error) => {
        console.error("Error removing contributor:", error);
        setError(t("failedToRemove"));
      });
  };

  // Generate the share link
  const shareLink = journalId ? `${HOSTNAME}/share?journal=${journalId}` : "";

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
      <DialogContent className="" onCloseAutoFocus={onClose}>
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
                          <SelectTrigger>
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
              className="text-destructive-foreground px-4 py-3 rounded relative mt-2"
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
