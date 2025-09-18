import Image from "next/image";
import { Building2, Mail, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { contactInfoSchemaType } from "../../../../../../../../backend/functions/src/common/schemas/common_schemas";

interface EstimateHeaderProps {
  contactInfo?: contactInfoSchemaType;
  logo?: string | null;
}

export function EstimateHeader({
  logo = "/placeholder.svg?height=40&width=120",
  contactInfo,
}: EstimateHeaderProps) {
  return (
    <div className="print:shadow-none print:max-w-none print:mx-0 print:w-full border-b px-2 pb-1">
      <div className="flex flex-wrap justify-between items-start gap-2 print:gap-1">
        {/* logo and address */}
        <div className="flex items-center space-x-2 print:space-x-1">
          <Image
            src={logo || "/placeholder.svg"}
            alt={`${contactInfo?.name || "Company"} logo`}
            width={30}
            height={30}
            className="h-10 w-auto print:h-8"
          />
          <div className="flex flex-col">
            <h1 className="text-lg font-bold tracking-tight text-primary print:text-base">
              {contactInfo?.name || "Acme Industries"}
            </h1>
            {contactInfo?.address && (
              <div className="mt-1 text-2xs text-muted-foreground hover:text-primary flex flex-wrap gap-1">
                <span>{contactInfo.address.street},</span>
                <span>
                  {contactInfo.address.city}, {contactInfo.address.state}{" "}
                  {contactInfo.address.zipCode}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end space-y-1 text-2xs text-muted-foreground hover:text-primary">
          <div className="flex items-center space-x-1">
            <Phone className="h-3 w-3" />
            <span>{contactInfo?.phone || "(555) 123-4567"}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Mail className="h-3 w-3" />
            <span>{contactInfo?.email || "billing@acmeindustries.com"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
