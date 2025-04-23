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
} from "@/../../backend/functions/src/common/schemas/common_schemas";
import { functions } from "@/lib/auth_handler";

import { SharableLink } from "@/components/ui/sharable-link";
//schema for an array of emails
const schema = z
  .object({
    email: z.string().email({ message: "Please enter a valid email." }),
    role: z.enum(["admin", "reporter", "viewer"]),
  })
  .strict();

type PersonType = z.infer<typeof schema>;

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
}: {
  journalId: string | undefined;
  access: AccessMap;
  pendingAccess: pendingAccessSchemaType;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [people, setPeople] = useState([] as AccessList[]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const errorMessage =
        error.message || "Something went wrong updating contributors";
      setError(errorMessage);
      // Handle specific error codes if the Firebase function returns them
      if (error.code === "functions/permission-denied") {
        setError("You don't have permission to modify contributors");
      } else if (error.code === "functions/invalid-argument") {
        setError("Invalid contributor information provided");
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
            email: k,
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
            setError("This email is already in the list with the same role.");
            return;
          }
          if (cur.role == "admin") {
            setError("You cannot change the role of an admin.");
            return;
          }
        }
        // Submit changes immediately
        await callAddContributor({
          email,
          role: form.getValues().role,
          operation: "add",
          journalId,
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
            setError("Failed to add contributor. Please try again.");
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
      journalId,
    })
      .then((result) => {
        if (result) {
          setPeople(updatedPeople);
          console.log("Contributor removed successfully");
        } else {
          setError("Failed to remove contributor. Please try again.");
        }
      })
      .catch((error) => {
        console.error("Error removing contributor:", error);
        setError("Failed to remove contributor. Please try again.");
      });
  };

  // Generate the share link
  const shareLink = journalId ? `${HOSTNAME}/share?journal=${journalId}` : "";

  return (
    <Dialog open={isOpen} onOpenChange={onOpenHandler}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" disabled={!journalId}>
          <UserPlus2 className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="" onCloseAutoFocus={onClose}>
        <DialogHeader>
          <DialogTitle>Add Contributors</DialogTitle>
          <DialogDescription>
            Add contributors to your journal
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <div className="grid grid-cols-6 gap-2 -mb-5 -mt-2">
            <div className="col-span-3">
              <Label htmlFor="email">Email</Label>
            </div>
            <div className="col-span-2">
              <Label htmlFor="role">Role</Label>
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
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="reporter">Reporter</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
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
                aria-label="Add new contributor"
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
                      {`${person.is_pending ? "Pending:" : ""} ${person.role}`}
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
                    <span className="sr-only">Remove</span>
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
                Close
              </Button>
            </div>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
