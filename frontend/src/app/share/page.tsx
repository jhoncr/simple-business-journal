"use client";
import { useEffect, useState, Suspense, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth, functions } from "@/lib/auth_handler";
import { httpsCallable } from "firebase/functions";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslations } from "next-intl";

function SharePageContent() {
  const t = useTranslations();
  const router = useRouter();
  const { authUser, loading, signOut, signInWithGoogle } = useAuth();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [journalId, setJournalId] = useState<string | null>(null);

  const schema = useMemo(
    () =>
      z
        .object({
          journalID: z.string().min(20, t("Share.invalidJournalId")),
        })
        .strict(),
    [t],
  );

  useEffect(() => {
    const journal_id = searchParams.get("journal");
    setJournalId(journal_id);

    if (authUser && journal_id) {
      const r = schema.safeParse({ journalID: journal_id });
      if (!r.success) {
        setError(r.error.issues[0]?.message || t("Share.invalidJournalId"));
      } else {
        setError(null);
      }
    }
  }, [authUser, searchParams, schema, t]);

  useEffect(() => {
    if (accepted && journalId) {
      router.replace(`/journal?jid=${journalId}`);
    }
  }, [accepted, journalId, router]);

  const accept = async () => {
    if (!journalId || isAccepting) return;

    setIsAccepting(true);
    const acceptShare = httpsCallable(functions, "acceptShare", {
      limitedUseAppCheckTokens: true,
    });

    try {
      await acceptShare({ jid: journalId, operation: "accept" });
      setAccepted(true);
    } catch (err: unknown) {
      console.error("Error accepting share invitation:", err);
      const message =
        err instanceof Error && err.message
          ? err.message
          : t("Share.genericError");
      setError(message);
    } finally {
      setIsAccepting(false);
    }
  };

  if (loading || accepted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <p>{t("common.loading")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <Dialog open={!!error}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("common.error")}</DialogTitle>
          </DialogHeader>
          <p>{error}</p>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setError(null);
                router.replace("/");
              }}
            >
              {t("entryPage.goHome")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setError(null);
                signOut();
              }}
            >
              {t("navigation.logout")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="max-w-md w-full p-6 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-4">{t("Share.title")}</h1>

        {!authUser ? (
          <>
            <p className="mb-4">{t("Share.guestPrompt")}</p>
            <Button className="w-full" onClick={() => signInWithGoogle()}>
              {t("Share.loginToAccept")}
            </Button>
          </>
        ) : (
          <>
            <p className="mb-4">{t("Share.invitedMessage")}</p>
            <Button
              onClick={accept}
              className="w-full mb-2"
              disabled={!journalId || isAccepting}
            >
              {isAccepting ? t("common.loading") : t("Share.acceptInvitation")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// Loading fallback for the Suspense boundary
function SharePageLoading() {
  const t = useTranslations();
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="max-w-md w-full p-6 rounded-lg shadow-md">
        <p>{t("Share.loadingDetails")}</p>
      </div>
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={<SharePageLoading />}>
      <SharePageContent />
    </Suspense>
  );
}
