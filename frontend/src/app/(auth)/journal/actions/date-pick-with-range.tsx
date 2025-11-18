"use client";
import { useState } from "react";
import { CalendarSearch } from "lucide-react";
import { addDays, format } from "date-fns";
// import { DateRange } from "react-day-picker"
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { on } from "events";

/*
  * Date picker with range
  * @param date - date range
  * @param setDate - set date range
  * @returns JSX.Element

*/

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
  const [selected, setSelected] = useState<DateRange | undefined>(daterange);
  const [open, setOpen] = useState(false);

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
        <Button id="daterange" variant={"outline"} size={"icon"}>
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
            date && setSelected(date as DateRange);
          }}
          numberOfMonths={2}
        />
        <div className="flex justify-end gap-2 p-2">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleGo}
            disabled={!selected?.from || !selected?.to}
          >
            Go
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
