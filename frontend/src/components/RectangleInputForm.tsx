"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Printer } from "lucide-react";
import { RectangleViewer, RectangleData } from "@/components/RectangleViewer";
import { useTranslations } from "next-intl";

export interface RectangleFormEntry {
  id: string;
  width: string;
  length: string;
  color: string;
  type: string;
}

export const RectangleInputForm: React.FC = () => {
  const t = useTranslations("draw.form");
  const [entries, setEntries] = useState<RectangleFormEntry[]>([
    { id: crypto.randomUUID(), width: "", length: "", color: "", type: "" },
  ]);
  const [names, setNames] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [annotations, setAnnotations] = useState("");

  const handleChange = (index: number, field: keyof RectangleFormEntry, value: string) => {
    const newEntries = [...entries];
    newEntries[index] = { ...newEntries[index], [field]: value };

    // Auto-grow logic:
    // If we just edited the very last row, we automatically spawn a new one below it
    // ONLY IF all required fields are defined.
    if (index === newEntries.length - 1) {
      const row = newEntries[index];
      const isComplete = 
        row.width.trim() !== "" &&
        row.length.trim() !== "" &&
        row.color.trim() !== "" &&
        row.type.trim() !== "";

      if (isComplete) {
        newEntries.push({
          id: crypto.randomUUID(),
          width: "",
          length: "",
          color: row.color,
          type: row.type,
        });
      }
    } else if (index === newEntries.length - 2) {
      // If we edited the second to last row, update the last row's prefilled color/type
      // if the last row hasn't been given dimensions yet.
      const lastRow = newEntries[newEntries.length - 1];
      if (lastRow.width === "" && lastRow.length === "") {
        newEntries[newEntries.length - 1] = {
          ...lastRow,
          color: newEntries[index].color,
          type: newEntries[index].type,
        };
      }
    }

    setEntries(newEntries);
  };

  const handleRemove = (index: number) => {
    // Only allow removal if there's more than one row.
    // Ensure we don't end up with completely empty state.
    if (entries.length > 1) {
      setEntries(entries.filter((_, i) => i !== index));
    }
  };

  // Derive display rectangles by filtering, grouping, and mapping over the valid entries
  const rectanglesToDisplay = React.useMemo(() => {
    const validEntries = entries.filter(
      (entry) =>
        entry.width.trim() !== "" &&
        entry.length.trim() !== "" &&
        Number(entry.width) > 0 &&
        Number(entry.length) > 0 &&
        entry.type.trim() !== "" &&
        entry.color.trim() !== ""
    );

    // Group items sequentially based on type and color
    const processedRects: RectangleData[] = [];
    const groupedData = new Map<string, RectangleFormEntry[]>();

    validEntries.forEach((entry) => {
      const groupKey = `${entry.type}-${entry.color}`.toLowerCase();
      if (!groupedData.has(groupKey)) {
        groupedData.set(groupKey, []);
      }
      groupedData.get(groupKey)!.push(entry);
    });

    groupedData.forEach((groupEntries, groupKey) => {
      groupEntries.forEach((entry, idx) => {
        let mappedProps: Partial<RectangleData> = {
          id: entry.id,
          width: Number(entry.width),
          length: Number(entry.length),
          groupId: groupKey,
        };

        // If it's the first in its group, add the label
        if (idx === 0) {
          let displayType = entry.type;
          if (entry.type === "window still") displayType = t("windowStill");
          else if (entry.type === "tile edge") displayType = t("tileEdge");
          mappedProps.label = `${displayType} | ${entry.color}`;
        }

        // Apply type-specific flags
        if (entry.type === "window still") {
          mappedProps.hasCrossLeft = true;
          mappedProps.hasLeftCornerCrosses = true;
          mappedProps.hasStroke = true;
        } else if (entry.type === "tile edge") {
          mappedProps.hasCrossLeft = true;
          mappedProps.hasStroke = false;
        }

        processedRects.push(mappedProps as RectangleData);
      });
    });

    return processedRects;
  }, [entries, t]);

  return (
    <div className="w-full space-y-8 print:space-y-0">
      <div className="w-full space-y-6 print:hidden">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">{t("orderDetails")}</h2>
          <Button onClick={() => window.print()} className="gap-2">
            <Printer className="w-4 h-4" />
            {t("print")}
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-card p-4 rounded-md border">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("namesOptional")}</label>
            <Input 
              value={names} 
              onChange={(e) => setNames(e.target.value)} 
              placeholder={t("namesPlaceholder")} 
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("addressOptional")}</label>
            <Input 
              value={deliveryAddress} 
              onChange={(e) => setDeliveryAddress(e.target.value)} 
              placeholder={t("addressPlaceholder")} 
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">{t("annotationsOptional")}</label>
            <Textarea 
              value={annotations} 
              onChange={(e) => setAnnotations(e.target.value)} 
              placeholder={t("annotationsPlaceholder")} 
              className="resize-y"
            />
          </div>
        </div>
        
        <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[15%]">{t("width")}</TableHead>
              <TableHead className="w-[15%]">{t("length")}</TableHead>
              <TableHead className="w-[20%]">{t("color")}</TableHead>
              <TableHead className="w-[30%]">{t("type")}</TableHead>
              <TableHead className="w-[10%] text-right">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry, index) => (
              <TableRow key={entry.id}>
                <TableCell>
                  <Input
                    type="number"
                    placeholder={t("placeholderW")}
                    value={entry.width}
                    onChange={(e) => handleChange(index, "width", e.target.value)}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    placeholder={t("placeholderL")}
                    value={entry.length}
                    onChange={(e) => handleChange(index, "length", e.target.value)}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="text"
                    placeholder={t("colorPlaceholder")}
                    value={entry.color}
                    onChange={(e) => handleChange(index, "color", e.target.value)}
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={entry.type}
                    onValueChange={(val) => handleChange(index, "type", val)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("selectType")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="window still">{t("windowStill")}</SelectItem>
                      <SelectItem value="tile edge">{t("tileEdge")}</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemove(index)}
                    disabled={entries.length === 1}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      </div>
      
      {/* Live Preview / Viewer Rendering */}
      {rectanglesToDisplay.length > 0 && (
        <div className="mt-8 pt-8 border-t border-border print:border-none print:mt-0 print:pt-0">
          <div className="flex justify-end items-end mb-6 print:hidden">
            <Button onClick={() => window.print()} variant="outline" className="gap-2">
              <Printer className="w-4 h-4" />
              {t("print")}
            </Button>
          </div>

          {/* Print Header */}
          {(names || deliveryAddress || annotations) && (
            <div className="hidden print:block print:mb-8 space-y-2">
              <div className="border-b pb-4 border-border">
                {names && <h2 className="text-xl font-bold mb-2">{t("orderFor")} {names}</h2>}
                {deliveryAddress && <p><strong>{t("deliveryAddressLabel")}</strong> {deliveryAddress}</p>}
                {annotations && <p><strong>{t("annotationsLabel")}</strong> {annotations}</p>}
              </div>
            </div>
          )}

          <RectangleViewer rectangles={rectanglesToDisplay} />
        </div>
      )}
    </div>
  );
};
