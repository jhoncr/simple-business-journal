import { RectangleInputForm } from "@/components/RectangleInputForm";
import { useTranslations } from "next-intl";

export default function DrawPage() {
  const t = useTranslations("draw");

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground print:min-h-0 print:justify-start">
      <h1 className="text-3xl font-bold mb-8 print:hidden">{t('title')}</h1>
      <div className="w-full p-2 border rounded-lg shadow-sm bg-card text-card-foreground print:p-0 print:border-none print:shadow-none print:bg-transparent">
        <RectangleInputForm />
      </div>
    </div>
  );
}
