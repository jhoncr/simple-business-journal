"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
  DrawerFooter,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

interface TaxFormProps {
  onSubmit: (tax: number) => void;
  disabled?: boolean;
}

export function TaxForm({ onSubmit, disabled }: TaxFormProps) {
  const [adjustmentTax, setAdjustmentTax] = React.useState(0);
  const [isOpen, setIsOpen] = React.useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)");

  const taxFormFields = (
    <form
      id="taxForm"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(adjustmentTax);
      }}
      className="space-y-4 print-hide"
    >
      <div
        className={cn(
          "gap-4 items-center",
          !isMobile && "grid grid-cols-[2fr_2fr_1fr_auto]" // Added auto column for button
        )}
      >
        <div></div>
        <Label className="text-right" htmlFor="adjustmentTax">
          Tax:
        </Label>
        <div className="relative">
          <Input
            className="peer  text-center"
            placeholder="Enter tax percentage"
            id="adjustmentTax"
            type="number"
            min="0"
            step="0.01"
            max="100"
            value={adjustmentTax}
            onChange={(e) => setAdjustmentTax(Number(e.target.value))}
            disabled={disabled}
            required
          />
          <span className="pointer-events-none absolute inset-y-0 end-0 flex items-center justify-center pe-3 text-sm text-muted-foreground peer-disabled:opacity-50">
            %
          </span>
        </div>
        {!isMobile && (
          <Button type="submit" className="self-start" disabled={disabled}>
            <Plus />
          </Button>
        )}
      </div>
    </form>
  );
  if (!isMobile) {
    return <div className="mobile-form print-hide">{taxFormFields}</div>;
  }
  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerTrigger asChild>
        <Button className="w-full" variant="secondary" disabled={disabled}>
          Set Tax Rate
        </Button>
      </DrawerTrigger>

      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Set Tax Rate</DrawerTitle>
          <DrawerClose
          //   onClick={() => {
          //     setActiveDrawer(null);
          //   }}
          />
        </DrawerHeader>
        {taxFormFields}
        <DrawerFooter>
          <Button
            type="submit"
            form="taxForm"
            className="w-full"
            onClick={() => setIsOpen(false)}
          >
            <Plus /> Add
          </Button>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
