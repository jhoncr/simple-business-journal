import Image from "next/image";
import { Mail, Phone } from "lucide-react";
import { contactInfoSchemaType } from "@backend/common/schemas/common_schemas";
import { useTranslations } from "next-intl";

interface EstimateHeaderProps {
  contactInfo?: contactInfoSchemaType;
  logo?: string | null;
}

export function EstimateHeader({
  logo,
  contactInfo,
}: EstimateHeaderProps) {
  const t = useTranslations("estimate");

  const cityStateZip = [
    contactInfo?.address?.city,
    [contactInfo?.address?.state, contactInfo?.address?.zipCode]
      .filter(Boolean)
      .join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  const addressParts = [contactInfo?.address?.street, cityStateZip].filter(
    Boolean,
  );

  return (
    <div className="print:shadow-none print:max-w-none print:mx-0 print:w-full border-b px-2 pb-2 md:pb-1">
      {/* Mobile-first responsive layout */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-2 print:gap-1">
        {/* Logo and company info */}
        <div className="flex items-center space-x-3 sm:space-x-2 print:space-x-1 min-w-0 flex-1">
          {logo && (
            <div className="flex-shrink-0">
              <Image
                src={logo}
                alt={`${contactInfo?.name || t("companyLogo")} ${t("logo")}`}
                width={30}
                height={30}
                className="h-10 w-10 sm:h-10 sm:w-auto object-contain print:h-8"
              />
            </div>
          )}
          <div className="flex flex-col min-w-0 flex-1">
            {contactInfo?.name && (
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-primary print:text-base leading-tight">
                {contactInfo.name}
              </h1>
            )}
            {addressParts.length > 0 && (
              <div className="mt-1 text-xs sm:text-2xs text-muted-foreground hover:text-primary">
                <div className="flex flex-col sm:flex-row sm:flex-wrap sm:gap-1">
                  {addressParts.map((part, idx) => (
                    <span key={idx} className="block sm:inline">
                      {part}
                      {idx < addressParts.length - 1 ? "," : ""}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Contact information */}
        {(contactInfo?.phone || contactInfo?.email) && (
          <div className="flex flex-row justify-between sm:flex-col items-start sm:items-end gap-3 sm:gap-1 text-xs sm:text-2xs text-muted-foreground hover:text-primary flex-shrink-0">
            {contactInfo?.phone && (
              <div className="flex items-center space-x-1">
                <Phone className="h-3 w-3 flex-shrink-0" />
                <span className="whitespace-nowrap">{contactInfo.phone}</span>
              </div>
            )}
            {contactInfo?.email && (
              <div className="flex items-center space-x-1">
                <Mail className="h-3 w-3 flex-shrink-0" />
                <span className="break-all sm:break-normal text-right sm:text-left">
                  {contactInfo.email}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
