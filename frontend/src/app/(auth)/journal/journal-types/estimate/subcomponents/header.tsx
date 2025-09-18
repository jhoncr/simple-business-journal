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
    <div className="print:shadow-none print:max-w-none print:mx-0 print:w-full border-b px-4 pb-1">
      <div className="flex flex-wrap justify-between items-center gap-4">
        {/* logo and address */}
        <div className="flex items-center space-x-3">
          <Image
            src={logo || "/placeholder.svg"}
            alt={`${contactInfo?.name || "Company"} logo`}
            width={40}
            height={40}
            className="h-16 w-auto"
          />
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold tracking-tight text-primary">
              {contactInfo?.name || "Acme Industries"}
            </h1>
            {contactInfo?.address && (
              <div className="mt-2 text-xs text-muted-foreground hover:text-primary flex flex-wrap gap-2">
                <span>{contactInfo.address.street},</span>
                <span>
                  {contactInfo.address.city}, {contactInfo.address.state}{" "}
                  {contactInfo.address.zipCode}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between h-full grow text-xs text-muted-foreground hover:text-primary  sm:flex-col sm:items-end sm:space-y-5">
          <div className="flex items-center justify-end space-x-2 ">
            <Phone className="h-4 w-4" />
            <span>{contactInfo?.phone || "(555) 123-4567"}</span>
          </div>
          <div className="flex items-center justify-end space-x-2 grow">
            <Mail className="h-4 w-4" />
            <span>{contactInfo?.email || "billing@acmeindustries.com"}</span>
          </div>
        </div>
      </div>
      {/* <Separator className="my-6" /> */}
    </div>
  );
}
