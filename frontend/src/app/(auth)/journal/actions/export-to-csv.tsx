import React from "react";
import { Download } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { AccessMap } from "@backend/common/schemas/common_schemas";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

interface DataObject {
  [key: string]: any;
}

interface Props {
  entry_list: DataObject[];
  filename: string;
  access: AccessMap;
}

export function formatContactInfo(contact: any): string {
  if (!contact || typeof contact !== "object") return "";
  const parts: string[] = [];
  if (contact.name) parts.push(contact.name);
  if (contact.email) parts.push(contact.email);
  if (contact.phone) parts.push(contact.phone);
  if (contact.address && typeof contact.address === "object") {
    const addr = contact.address;
    const addrParts: string[] = [];
    if (addr.street) addrParts.push(addr.street);
    if (addr.city) addrParts.push(addr.city);
    if (addr.state) addrParts.push(addr.state);
    if (addr.zipCode) addrParts.push(addr.zipCode);
    if (addr.country) addrParts.push(addr.country);
    if (addrParts.length > 0) parts.push(addrParts.join(", "));
  }
  return parts.join(" | ");
}

export function formatLineItems(items: any[]): string {
  if (!Array.isArray(items)) return "";
  return items
    .map((item) => {
      const qty = item?.quantity ?? 1;
      const desc = item?.description || item?.material?.description || "Item";
      const price = item?.material?.unitPrice != null ? item.material.unitPrice : 0;
      const currency = item?.material?.currency === "BRL" ? "R$" : "$";
      return `${qty}x ${desc} (${currency}${price})`;
    })
    .join("; ");
}

export function formatAdjustments(adjustments: any[]): string {
  if (!Array.isArray(adjustments)) return "";
  return adjustments
    .map((adj) => {
      const desc = adj?.description || adj?.type || "Adjustment";
      const val = adj?.value ?? 0;
      const isPercent =
        adj?.type && typeof adj.type === "string" && adj.type.toLowerCase().includes("percent");
      return `${desc}: ${isPercent ? `${val}%` : `$${val}`}`;
    })
    .join("; ");
}

export function formatPayments(payments: any[]): string {
  if (!Array.isArray(payments)) return "";
  const active = payments.filter((p) => !p?.deletedAt && !p?.isDeleted);
  return active
    .map((p) => {
      const amt = p?.amount ?? 0;
      const method = p?.method || "payment";
      let dateStr = "";
      if (p?.date) {
        if (typeof p.date.toDate === "function") {
          dateStr = p.date.toDate().toISOString().split("T")[0];
        } else if (p.date instanceof Date) {
          dateStr = p.date.toISOString().split("T")[0];
        } else if (typeof p.date === "string") {
          dateStr = p.date.split("T")[0];
        } else if (typeof p.date === "object" && typeof p.date.seconds === "number") {
          dateStr = new Date(p.date.seconds * 1000).toISOString().split("T")[0];
        }
      }
      const dateInfo = dateStr ? ` on ${dateStr}` : "";
      return `$${amt} (${method}${dateInfo})`;
    })
    .join("; ");
}

export function formatFieldValue(header: string, val: any): string {
  if (val === null || val === undefined) {
    return "";
  }
  if (typeof val === "string") {
    return val;
  }
  if (typeof val === "number" || typeof val === "boolean") {
    return String(val);
  }

  // Handle Firestore Timestamp or object with toDate()
  if (val instanceof Timestamp || (typeof val === "object" && typeof val.toDate === "function")) {
    return val.toDate().toISOString();
  }
  if (val instanceof Date) {
    return val.toISOString();
  }
  if (
    typeof val === "object" &&
    typeof val.seconds === "number" &&
    typeof val.nanoseconds === "number"
  ) {
    return new Date(val.seconds * 1000 + val.nanoseconds / 1000000).toISOString();
  }

  // Specific nested domain serializers
  if (header === "details.customer" || header === "details.supplier") {
    return formatContactInfo(val);
  }
  if (header === "details.confirmedItems") {
    return formatLineItems(val);
  }
  if (header === "details.adjustments") {
    return formatAdjustments(val);
  }
  if (header === "details.payments") {
    return formatPayments(val);
  }

  // Fallback for any other nested objects/arrays to guarantee no "[object Object]"
  try {
    return JSON.stringify(val);
  } catch {
    return "";
  }
}

export const dataToCSV = (entry_list: DataObject[], access?: AccessMap) => {
  if (!entry_list || !Array.isArray(entry_list) || entry_list.length === 0) {
    return "";
  }

  try {
    const headers: string[] = [];
    const seen = new Set<string>();

    entry_list.forEach((object) => {
      if (!object) return;
      Object.keys(object).forEach((header) => {
        if (header === "details" && object.details && typeof object.details === "object") {
          Object.keys(object.details).forEach((dk) => {
            const h = `details.${dk}`;
            if (!seen.has(h)) {
              seen.add(h);
              headers.push(h);
            }
          });
        } else if (header !== "details") {
          if (!seen.has(header)) {
            seen.add(header);
            headers.push(header);
          }
        }
      });
    });

    const csv = [headers.join(",")];

    entry_list.forEach((object) => {
      const values = headers.map((header) => {
        let v;
        if (header === "createdBy") {
          v = access?.[object[header]]?.email || object[header] || "";
        } else if (header.startsWith("details.")) {
          const detailKey = header.slice(8);
          v = object?.details ? object.details[detailKey] : "";
        } else {
          v = object?.[header];
        }

        const formatted = formatFieldValue(header, v);
        const strVal = String(formatted).replaceAll('"', '""');
        return `"${strVal}"`;
      });
      csv.push(values.join(","));
    });

    return csv.join("\r\n");
  } catch (error) {
    console.error("Error generating CSV:", error);
    console.error("entry_list", entry_list);
    throw new Error("Error generating CSV");
  }
};

const ExportToCSV = ({ entry_list, filename, access }: Props) => {
  const t = useTranslations("journal");

  const downloadCSV = () => {
    const csv = dataToCSV(entry_list, access);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  return entry_list.length === 0 ? null : (
    <Button
      onClick={downloadCSV}
      className="flex flex-row items-center text-sm font-bold space-x-2"
      variant="brutalist"
    >
      <Download size={16} />
      <p>{t("download")}</p>
    </Button>
  );
};

export default ExportToCSV;
