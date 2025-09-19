'use client'
import React from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function AboutPageClient() {
  const t = useTranslations("AboutPage");

  return (
    <>
      <main className="flex flex-col items-center justify-center min-h-screen m-4">
        <h1 className="text-4xl font-bold">{t("title")}</h1>

        <p className="mt-3 text-2xl">{t("subtitle")}</p>

        <Link href="/" className="mt-8">
          <Button className="px-4 py-2 text-white bg-blue-500 rounded-md">
            {t("tryIt")}
          </Button>
        </Link>
      </main>
      <footer className="flex items-center justify-center w-full h-24 border-t">
        <h2>
          {t("footer", {
            author: <a href="https://twitter.com/J3Cordeiro">Jhon</a>,
          })}
        </h2>
      </footer>
    </>
  );
}
