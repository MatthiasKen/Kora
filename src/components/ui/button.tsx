import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";
// Locally owned shadcn/ui-style components, built on Radix primitives.
export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "icon";
};
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "default", size = "default", asChild, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50",
          variant === "default" &&
            "bg-primary text-white hover:bg-primary-dark active:scale-[.98]",
          variant === "outline" &&
            "border border-border bg-white hover:bg-muted",
          variant === "ghost" && "hover:bg-muted",
          size === "default" && "min-h-12 px-6",
          size === "sm" && "min-h-10 px-4",
          size === "icon" && "size-11 p-0",
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
