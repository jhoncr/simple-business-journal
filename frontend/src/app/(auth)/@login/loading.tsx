"use client";
import { useTranslations } from "next-intl";

export default function LoadingLogin() {
  const t = useTranslations("common");
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground">{t("loading")}</p>
    </div>
  );
}
