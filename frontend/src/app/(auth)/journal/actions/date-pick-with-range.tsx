"use client"
import { useState } from "react"
import { CalendarSearch } from "lucide-react"
import { addDays, format } from "date-fns"
// import { DateRange } from "react-day-picker"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { on } from "events"

/*
  * Date picker with range
  * @param date - date range
  * @param setDate - set date range
  * @returns JSX.Element

*/

interface DateRange {
  from: Date
  to: Date
}

export function DatePickerWithRange({
  daterange,
  setDate
}: {
  daterange: DateRange | undefined
  setDate: React.Dispatch<React.SetStateAction<DateRange | undefined>>
}) {

  const [selected, setSelected] = useState<DateRange | undefined>(daterange)


  const handleOpenChange = (open: boolean) => {
    if (!open) {
      console.log("closing", selected)
      setDate(selected)
    }
  }

  return (
      <Popover onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            id="daterange"
            variant={"outline"}
            size={"icon"}
          >
            <CalendarSearch className="h-5 w-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={ daterange?.from ?? new Date() }
            selected={selected}
            onSelect={ (date) => { date && setSelected(date as DateRange) } }
            numberOfMonths={2}
            
          />
        </PopoverContent>
      </Popover>

  )
}

// {date?.from ? (
//   date.to ? (
//     <>
//       {format(date.from, "LLL dd, y")} -{" "}
//       {format(date.to, "LLL dd, y")}
//     </>
//   ) : (
//     format(date.from, "LLL dd, y")
//   )
// ) : (
//   <span>Pick a date</span>
// )}
