import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonGroupVariants = cva("inline-flex items-stretch gap-0 rounded-md", {
  variants: {
    orientation: {
      horizontal: "flex-row",
      vertical: "flex-col",
    },
  },
  defaultVariants: {
    orientation: "horizontal",
  },
});

export interface ButtonGroupProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof buttonGroupVariants> {}

const ButtonGroup = React.forwardRef<HTMLDivElement, ButtonGroupProps>(
  ({ className, orientation, ...props }, ref) => (
    <div
      ref={ref}
      role="group"
      className={cn(
        buttonGroupVariants({ orientation }),
        "[&>*:first-child]:rounded-l-md [&>*:first-child]:rounded-r-none",
        "[&>*:last-child]:rounded-r-md [&>*:last-child]:rounded-l-none",
        "[&>*:not(:first-child):not(:last-child)]:rounded-none",
        "[&>button:not(:first-child)]:border-l-0",
        orientation === "vertical" &&
          "[&>*:first-child]:rounded-t-md [&>*:first-child]:rounded-b-none [&>*:last-child]:rounded-b-md [&>*:last-child]:rounded-t-none [&>button:not(:first-child)]:border-t-0 [&>button:not(:first-child)]:border-l",
        className,
      )}
      {...props}
    />
  ),
);
ButtonGroup.displayName = "ButtonGroup";

const buttonGroupSeparatorVariants = cva("bg-border shrink-0", {
  variants: {
    orientation: {
      horizontal: "w-px h-auto",
      vertical: "h-px w-auto",
    },
  },
  defaultVariants: {
    orientation: "vertical",
  },
});

export interface ButtonGroupSeparatorProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof buttonGroupSeparatorVariants> {}

const ButtonGroupSeparator = React.forwardRef<
  HTMLDivElement,
  ButtonGroupSeparatorProps
>(({ className, orientation, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(buttonGroupSeparatorVariants({ orientation }), className)}
    {...props}
  />
));
ButtonGroupSeparator.displayName = "ButtonGroupSeparator";

export interface ButtonGroupTextProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  asChild?: boolean;
}

const ButtonGroupText = React.forwardRef<
  HTMLSpanElement,
  ButtonGroupTextProps
>(({ className, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "span";
  return (
    <Comp
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium bg-muted px-3",
        className,
      )}
      {...props}
    />
  );
});
ButtonGroupText.displayName = "ButtonGroupText";

export { ButtonGroup, ButtonGroupSeparator, ButtonGroupText };
