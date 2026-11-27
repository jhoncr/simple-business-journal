"use client";
import { useAuth } from "@/lib/auth_handler";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { User } from "firebase/auth";
import { UserNav } from "@/components/ui/user-nav";
import { toolbarContext } from "./nav_tool_handler";
import { useTranslations } from "next-intl";

function Header({
  user,
  signOut,
  tools,
}: {
  user: User;
  signOut: () => Promise<void> | void;
  tools: React.ReactNode;
}) {
  const tNav = useTranslations("navigation");
  const [atTop, setAtTop] = useState(true);
  useEffect(() => {
    const handleScroll = () => {
      const isAtTop = window.scrollY < 10;
      setAtTop((prev) => (prev !== isAtTop ? isAtTop : prev));
    };
    document.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      document.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <header
      className={`flex flex-row items-center justify-between w-full px-3 py-2 print:hidden sticky top-0 z-50 transition-all duration-200 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 ${
        !atTop ? "border-b shadow-sm" : ""
      }`}
    >
      <Link href="/" className="text-xl font-semibold mr-4" aria-label={tNav("home")}>
        <div className="flex items-center">
          <Image src="/logo.svg" alt={tNav("home")} width={24} height={24} />
        </div>
      </Link>

      <div className="px-1 w-full">{tools}</div>

      <UserNav user={user} signOut={signOut} />
    </header>
  );
}

export default function NeedLoginLayout({
  children,
  login,
}: {
  children: React.ReactNode;
  login: React.ReactNode;
}) {
  const { authUser, loading, signOut } = useAuth();
  const tCommon = useTranslations("common");
  const [toolbar, setToolBar] = useState<React.ReactNode>(null);
  const toolbarValue = useMemo(() => ({ setToolBar }), []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">{tCommon("loading")}</p>
      </div>
    );
  }

  return (
    <>
      {authUser ? (
        <toolbarContext.Provider value={toolbarValue}>
          <div className="flex flex-col h-screen print:h-auto print:block print:overflow-visible">
            <Header user={authUser} signOut={signOut} tools={toolbar} />
            {children}
          </div>
        </toolbarContext.Provider>
      ) : (
        login
      )}
    </>
  );
}
