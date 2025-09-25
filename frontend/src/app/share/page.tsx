"use client";
import { useEffect, useState, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { redirect } from "next/navigation";
import { useAuth } from "@/lib/auth_handler";
import { getFunctions, httpsCallable } from "firebase/functions";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslations } from "next-intl";

function SharePageContent() {
  const t = useTranslations();
  const { authUser, loading, signOut, signInWithGoogle } = useAuth();
  const searchParams = useSearchParams();
  const [error, setError] = useState(null as string | null);
  const [accepted, setAccepted] = useState(false);
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
      // validate journal_id
      const r = schema.safeParse({ journalID: journal_id });
      if (!r.success) {
        setError(r.error.message);
      }
    }
  }, [authUser, searchParams]);

  const GoToJournal = () => {
    console.log("redirecting to journal", accepted);
    redirect(`/journal?jid=${journalId}`);
  };

  const accept = () => {
    if (!journalId) return;

    console.log("sending accept call to the backend");
    const acceptShare = httpsCallable(getFunctions(), "acceptShare", {
      limitedUseAppCheckTokens: true,
    });

    async function sendAccept(data: any) {
      try {
        const result = await acceptShare(data);
        setAccepted(true);
      } catch (error: any) {
        console.log("ops, something went wrong :/", error);
        setError(error?.message ?? t("Share.genericError"));
      }
    }

    let payload = { businessID: journalId, operation: "accept" };
    console.log("payload", payload);
    sendAccept(payload);
  };

  if (loading) {
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
          <Button
            variant="destructive"
            onClick={() => {
              setError(null);
              signOut();
            }}
          >
            {t("navigation.logout")}
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  if (accepted) {
    return <GoToJournal />;
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
              disabled={!journalId}
            >
              {t("Share.acceptInvitation")}
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
