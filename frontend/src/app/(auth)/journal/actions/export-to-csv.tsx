import React from "react";
// import the downlload icon form lucide
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

// TODO: add createdBy using email instead of uid
// TODO: maybe change the date format to a more human readable on google sheets
const dataToCSV = (entry_list: DataObject[], access: AccessMap) => {
  try {
    const headers = Object.keys(entry_list[0])
      .map((header) => {
        // if details, return the keys of details (e.g. details.date, details.description, details.value)
        // else return the header
        if (header.startsWith("details")) {
          let details = entry_list[0]?.details || {};
          return Object.keys(details).map(
            (detailKey) => `details.${detailKey}`,
          );
        }
        return header;
      })
      .flat();

    const csv = [headers.join(",")];

    // base date as Dec 30, 1899 in UTC time
    entry_list.forEach((object) => {
      const values = headers.map((header) => {
        let v;
        if (header === "createdBy") {
          v = access?.[object[header]]?.email || object[header] || "";
        } else if (header.startsWith("details.")) {
          const detailKey = header.split(".")[1];
          v = object.details ? object.details[detailKey] : "";
        } else {
          v = object[header];
        }

        if (v === null || v === undefined) {
          return '""';
        }

        if (v instanceof Timestamp) {
          return `"${v.toDate().toISOString()}"`;
        }

        const strVal = String(v).replaceAll('"', '""');
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
