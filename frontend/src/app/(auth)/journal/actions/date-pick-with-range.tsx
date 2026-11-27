"use client";
import { useEffect, useState } from "react";
import { CalendarSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTranslations } from "next-intl";
import { useMediaQuery } from "@/hooks/use-media-query";

interface DateRange {
  from: Date;
  to: Date;
}

export function DatePickerWithRange({
  daterange,
  setDate,
}: {
  daterange: DateRange | undefined;
  setDate: React.Dispatch<React.SetStateAction<DateRange | undefined>>;
}) {
  const t = useTranslations("common");
  const tJournal = useTranslations("journal");
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [selected, setSelected] = useState<DateRange | undefined>(daterange);
  const [open, setOpen] = useState(false);

  // Sync internal selection when parent resets or updates the date range
  useEffect(() => {
    setSelected(daterange);
  }, [daterange]);

  const handleGo = () => {
    setDate(selected);
    setOpen(false);
  };

  const handleCancel = () => {
    setSelected(daterange);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id="daterange"
          variant={"outline"}
          size={"icon"}
          aria-label={tJournal("dateFilter")}
        >
          <CalendarSearch className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          initialFocus
          mode="range"
          defaultMonth={daterange?.from ?? new Date()}
          selected={selected}
          onSelect={(date) => {
            setSelected(date as DateRange | undefined);
          }}
          numberOfMonths={isDesktop ? 2 : 1}
        />
        <div className="flex justify-end gap-2 p-2">
          <Button type="button" variant="outline" onClick={handleCancel}>
            {t("cancel")}
          </Button>
          <Button
            type="button"
            onClick={handleGo}
            disabled={!selected?.from || !selected?.to}
          >
            {t("go")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
