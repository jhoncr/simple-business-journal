"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { QuoteDetails } from "@/app/(auth)/journal/journal-types/quote/addQuote";

export default function WIPPage() {
  const router = useRouter();
  const isDevelopment = process.env.NODE_ENV === "development";

  useEffect(() => {
    if (!isDevelopment) {
      router.replace("/");
    }
  }, [router]);

  if (!isDevelopment) {
    return null;
  }

  return (
    <div className="container mx-auto p-4">
      {/* <div className="bg-yellow-100 border-l-4 border-yellow-500 p-4 mb-4">
        <p className="text-yellow-700">
          ⚠️ This page is under development and only visible in development
          mode
        </p>
      </div> */}
      {/* <QuoteDetails /> */}
    </div>
  );
}
