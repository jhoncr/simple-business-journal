"use client";

import { useState } from "react";
import Image from "next/image";
import { MinusCircle, UploadCloud } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";

interface LogoUploadProps {
  setLogo?: (logo: string | null) => void;
  logo?: string | null;
}

export function LogoUpload({ setLogo, logo }: LogoUploadProps) {
  const t = useTranslations("logoUpload");
  const { toast } = useToast();

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== "image/svg+xml") {
        toast({ title: t("svgOnlyError"), variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setLogo?.(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setLogo?.(null);
  };

  return (
    <div className="relative w-24 h-24 border rounded-md overflow-hidden">
      {logo ? (
        <div className="relative w-full h-full">
          <Image
            src={logo}
            alt={t("companyLogoAlt")}
            fill
            className="object-contain"
          />
          <button
            onClick={handleRemoveLogo}
            className="absolute top-1 right-1 bg-white rounded-full p-1 shadow-sm hover:bg-gray-100"
          >
            <MinusCircle className="h-4 w-4 text-gray-600" />
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer bg-gray-50 hover:bg-gray-100">
          <UploadCloud className="h-6 w-6 text-gray-400" />
          <span className="text-xs text-gray-500">{t("addLogo")}</span>
          <input
            type="file"
            className="hidden"
            accept=".svg"
            onChange={handleLogoUpload}
          />
        </label>
      )}
    </div>
  );
}

