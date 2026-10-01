"use client";
import * as React from "react";
import * as Primitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
export const Sheet = Primitive.Root;
export const SheetTitle = Primitive.Title;
export const SheetDescription = Primitive.Description;
export const SheetClose = Primitive.Close;
export function SheetContent({
  children,
  className,
  side = "right",
  ...props
}: React.ComponentPropsWithoutRef<typeof Primitive.Content> & {
  side?: "right" | "left";
}) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay className="dialog-overlay" />
      <Primitive.Content
        className={cn(
          "sheet-content",
          side === "left" && "sheet-left",
          className,
        )}
        {...props}
      >
        {children}
        <Primitive.Close className="dialog-close" aria-label="Close panel">
          <X size={21} />
        </Primitive.Close>
      </Primitive.Content>
    </Primitive.Portal>
  );
}
