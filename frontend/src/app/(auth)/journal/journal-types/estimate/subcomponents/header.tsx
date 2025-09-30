import Image from "next/image";
import { Building2, Mail, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { contactInfoSchemaType } from "../../../../../../../../backend/functions/src/common/schemas/common_schemas";
import { useTranslations } from "next-intl";

interface EstimateHeaderProps {
  contactInfo?: contactInfoSchemaType;
  logo?: string | null;
}

export function EstimateHeader({
  logo = "/placeholder.svg?height=40&width=120",
  contactInfo,
}: EstimateHeaderProps) {
  const t = useTranslations("estimate");

  return (
    <div className="print:shadow-none print:max-w-none print:mx-0 print:w-full border-b px-2 pb-2 md:pb-1">
      {/* Mobile-first responsive layout */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-2 print:gap-1">
        {/* Logo and company info */}
        <div className="flex items-start space-x-3 sm:space-x-2 print:space-x-1 min-w-0 flex-1">
          <div className="flex-shrink-0">
            <Image
              src={logo || "/placeholder.svg"}
              alt={`${contactInfo?.name || t("companyLogo")} ${t("logo")}`}
              width={30}
              height={30}
              className="h-10 w-10 sm:h-10 sm:w-auto object-contain print:h-8"
            />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-primary print:text-base leading-tight">
              {contactInfo?.name || t("defaultCompanyName")}
            </h1>
            {contactInfo?.address && (
              <div className="mt-1 text-xs sm:text-2xs text-muted-foreground hover:text-primary">
                <div className="flex flex-col sm:flex-row sm:flex-wrap sm:gap-1">
                  <span className="block sm:inline">
                    {contactInfo.address.street},
                  </span>
                  <span className="block sm:inline">
                    {contactInfo.address.city}, {contactInfo.address.state}{" "}
                    {contactInfo.address.zipCode}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Contact information */}
        <div className="flex flex-row justify-between sm:flex-col items-start sm:items-end gap-3 sm:gap-1 text-xs sm:text-2xs text-muted-foreground hover:text-primary flex-shrink-0">
          <div className="flex items-center space-x-1">
            <Phone className="h-3 w-3 flex-shrink-0" />
            <span className="whitespace-nowrap">
              {contactInfo?.phone || t("defaultPhone")}
            </span>
          </div>
          <div className="flex items-center space-x-1">
            <Mail className="h-3 w-3 flex-shrink-0" />
            <span className="break-all sm:break-normal text-right sm:text-left">
              {contactInfo?.email || t("defaultEmail")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
