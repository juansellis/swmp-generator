"use client";

import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

type AccordionContextValue = {
  open: string;
  setOpen: (v: string) => void;
  type: "single" | "multiple";
  collapsible: boolean;
};

const AccordionContext = React.createContext<AccordionContextValue | null>(null);

type AccordionProps = React.ComponentPropsWithoutRef<"div"> & {
  type?: "single" | "multiple";
  collapsible?: boolean;
  defaultValue?: string;
  value?: string;
  onValueChange?: (v: string) => void;
};

const Accordion = React.forwardRef<HTMLDivElement, AccordionProps>(
  ({ type = "single", collapsible = true, defaultValue = "", value: controlledValue, onValueChange, className, children, ...props }, ref) => {
    const [uncontrolled, setUncontrolled] = React.useState(defaultValue);
    const isControlled = controlledValue !== undefined;
    const open = isControlled ? controlledValue : uncontrolled;
    const setOpen = React.useCallback(
      (v: string) => {
        if (!isControlled) setUncontrolled(v);
        onValueChange?.(v);
      },
      [isControlled, onValueChange]
    );
    const ctx: AccordionContextValue = React.useMemo(
      () => ({ open, setOpen, type, collapsible }),
      [open, setOpen, type, collapsible]
    );
    return (
      <AccordionContext.Provider value={ctx}>
        <div ref={ref} className={cn(className)} data-state={open ? "open" : "closed"} {...props}>
          {children}
        </div>
      </AccordionContext.Provider>
    );
  }
);
Accordion.displayName = "Accordion";

type AccordionItemContextValue = { value: string };
const AccordionItemContext = React.createContext<AccordionItemContextValue | null>(null);

type AccordionItemProps = React.ComponentPropsWithoutRef<"div"> & { value: string };

const AccordionItem = React.forwardRef<HTMLDivElement, AccordionItemProps>(
  ({ value, className, ...props }, ref) => (
    <AccordionItemContext.Provider value={{ value }}>
      <div ref={ref} className={cn("border-b", className)} data-state={undefined} {...props} />
    </AccordionItemContext.Provider>
  )
);
AccordionItem.displayName = "AccordionItem";

const AccordionTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<"button"> & { asChild?: boolean }
>(({ className, children, asChild, ...props }, ref) => {
  const accordion = React.useContext(AccordionContext);
  const item = React.useContext(AccordionItemContext);
  if (!accordion || !item) return null;
  const isOpen = accordion.open === item.value;
  const handleClick = () => {
    const next = isOpen && accordion.collapsible ? "" : item.value;
    accordion.setOpen(next);
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };
  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      type="button"
      aria-expanded={isOpen}
      data-state={isOpen ? "open" : "closed"}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "flex w-full items-center justify-between gap-3 py-4 px-4 font-medium transition-colors cursor-pointer hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-t-lg [&:last-child]:rounded-b-lg",
        className
      )}
      {...props}
    >
      <span className="flex-1 min-w-0 text-left">{children}</span>
      <span className="shrink-0 flex items-center justify-center" aria-hidden>
        {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
      </span>
    </button>
  );
});
AccordionTrigger.displayName = "AccordionTrigger";

const AccordionContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<"div">
>(({ className, children, ...props }, ref) => {
  const accordion = React.useContext(AccordionContext);
  const item = React.useContext(AccordionItemContext);
  if (!accordion || !item) return null;
  const isOpen = accordion.open === item.value;
  if (!isOpen) return null;
  return (
    <div
      ref={ref}
      className={cn("overflow-hidden text-sm pb-4 pt-0", className)}
      data-state={isOpen ? "open" : "closed"}
      {...props}
    >
      {children}
    </div>
  );
});
AccordionContent.displayName = "AccordionContent";

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
