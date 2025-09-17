import { useState } from 'react';
import { CalendarIcon } from "@radix-ui/react-icons";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { estimateDetailsState } from '@/../../backend/functions/src/common/schemas/estimate_schema';

interface InvoiceDetailsProps {
  entryId: string | null | undefined;
  dueDate: Date | null | undefined;
  setDueDate: (date: Date | null | undefined) => void;
  handleSave: (updates: Partial<estimateDetailsState>) => Promise<boolean>;
  isSaving: boolean;
}

export const InvoiceDetails = ({ entryId, dueDate, setDueDate, handleSave, isSaving }: InvoiceDetailsProps) => {
  const [dueDatePopoverOpen, setDueDatePopoverOpen] = useState(false);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 border-b pb-4">
      <div>
        <Label>Invoice Number</Label>
        <div
          id="invoiceNumber"
          className="text-sm font-medium text-muted-foreground"
        >
          {entryId ? entryId : "Not yet invoiced"}
        </div>
      </div>
      <div>
        <Label htmlFor="dueDate">Due Date</Label>
        <Popover
          modal
          open={dueDatePopoverOpen}
          onOpenChange={setDueDatePopoverOpen}
        >
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal",
                !dueDate && "text-muted-foreground",
              )}
              disabled={isSaving}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dueDate ? (
                format(dueDate, "PPP")
              ) : (
                <span>Pick a date</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dueDate || undefined}
              onSelect={(date) => {
                setDueDate(date);
                if (date) handleSave({ dueDate: date });
                setDueDatePopoverOpen(false);
              }}
              disabled={isSaving}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};