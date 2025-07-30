"use client";
import { useAuth } from "@/lib/auth_handler";
// import { JournalListProvider } from "@/lib/db_handler";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { UserNav } from "@/components/ui/user-nav";
import { toolbarContext } from "./nav_tool_handler";

function Header({
  user,
  signOut,
  tools,
}: {
  user: any;
  signOut: any;
  tools: React.ReactNode;
}) {
  const [atTop, setAtTop] = useState(true);
  useEffect(() => {
    const handleScroll = () => {
      const isAtTop = window.scrollY < 10;
      if (isAtTop !== atTop) {
        setAtTop(isAtTop);
      }
    };
    document.addEventListener("scroll", handleScroll);
    return () => {
      document.removeEventListener("scroll", handleScroll);
    };
  }, [atTop]);

  // header is fixed at the top of the page with a shadow and border at the bottom

  return (
    <header className="flex flex-row items-center justify-between w-full px-3 py-1 border-b-2 h-content print:hidden">
      <Link href="/" className="text-xl font-semibold mr-4">
        <div className="flex items-center">
          <Image src="/logo.svg" alt="logo" width={24} height={24} />
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
  const { authUser, signOut } = useAuth();
  const [toolbar, setToolBar] = useState(null as React.ReactNode);

  useEffect(() => {
    console.log("Loading Layout. User:", authUser);
  }, [authUser]);

  return (
    <>
      {authUser ? (
        <>
          <toolbarContext.Provider value={{ setToolBar }}>
            <Header user={authUser} signOut={signOut} tools={toolbar} />
            {children}
          </toolbarContext.Provider>
        </>
      ) : (
        login
      )}
    </>
  );
}
