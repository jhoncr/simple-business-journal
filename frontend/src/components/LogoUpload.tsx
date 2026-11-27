"use client";

import Image from "next/image";
import { MinusCircle, UploadCloud } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";

const MAX_LOGO_SIZE_BYTES = 100 * 1024; // 100 KB
const UNSAFE_SVG_PATTERN =
  /<script[\s>]|<\/script>|javascript:|<foreignObject[\s>]|\bon[a-z]+\s*=/i;

interface LogoUploadProps {
  setLogo?: (logo: string | null) => void;
  logo?: string | null;
}

export function LogoUpload({ setLogo, logo }: LogoUploadProps) {
  const t = useTranslations("logoUpload");
  const { toast } = useToast();

  const handleLogoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    // Reset input value so selecting the same file again triggers onChange
    event.target.value = "";
    if (!file) return;

    if (file.type !== "image/svg+xml") {
      toast({ title: t("svgOnlyError"), variant: "destructive" });
      return;
    }

    if (file.size > MAX_LOGO_SIZE_BYTES) {
      toast({ title: t("fileTooLargeError"), variant: "destructive" });
      return;
    }

    try {
      const svgText = await file.text();
      if (UNSAFE_SVG_PATTERN.test(svgText)) {
        toast({ title: t("unsafeSvgError"), variant: "destructive" });
        return;
      }
    } catch {
      toast({ title: t("unsafeSvgError"), variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setLogo?.(result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogo?.(null);
  };

  return (
    <div className="relative w-24 h-24 border border-border rounded-md overflow-hidden bg-background">
      {logo ? (
        <div className="relative w-full h-full">
          <Image
            src={logo}
            alt={t("companyLogoAlt")}
            fill
            className="object-contain"
          />
          <button
            type="button"
            onClick={handleRemoveLogo}
            aria-label={t("removeLogo")}
            className="absolute top-1 right-1 bg-background/90 text-foreground rounded-full p-1 shadow-sm hover:bg-accent"
          >
            <MinusCircle className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer bg-muted/40 hover:bg-muted transition-colors">
          <UploadCloud className="h-6 w-6 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{t("addLogo")}</span>
          <input
            type="file"
            className="hidden"
            accept=".svg,image/svg+xml"
            onChange={handleLogoUpload}
          />
        </label>
      )}
    </div>
  );
}

