"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface RoleCardProps {
  value: string;
  role: string;
  party: string;
  responsibilities: string[];
  onRoleChange: (value: string) => void;
  onPartyChange: (value: string) => void;
  onResponsibilitiesChange: (lines: string[]) => void;
  rolePlaceholder?: string;
  partyPlaceholder?: string;
  responsibilitiesPlaceholder?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
}

export function RoleCard({
  value,
  role,
  party,
  responsibilities,
  onRoleChange,
  onPartyChange,
  onResponsibilitiesChange,
  rolePlaceholder = "e.g. SWMP Owner",
  partyPlaceholder = "e.g. Main Contractor",
  responsibilitiesPlaceholder = "Maintain SWMP\nCoordinate waste streams",
  disabled,
  icon,
  defaultOpen = true,
}: RoleCardProps) {
  const responsibilitiesText = Array.isArray(responsibilities)
    ? responsibilities.filter(Boolean).join("\n")
    : "";

  return (
    <Accordion
      type="single"
      collapsible
      defaultValue={defaultOpen ? value : ""}
      className="rounded-lg border border-border/50 overflow-hidden bg-card"
    >
      <AccordionItem value={value} className="border-0">
        <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/40 [&>svg]:shrink-0">
          <span className="flex items-center justify-between w-full pr-2">
            <span className="flex items-center gap-2 min-w-0">
              {icon ? <span className="shrink-0 text-muted-foreground">{icon}</span> : null}
              <span className="text-sm font-medium truncate">{role || rolePlaceholder}</span>
            </span>
            <Badge variant="secondary" className="shrink-0 ml-2 font-normal">
              {party || "—"}
            </Badge>
          </span>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4 pt-0">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Role</Label>
                <Input
                  value={role}
                  onChange={(e) => onRoleChange(e.target.value)}
                  placeholder={rolePlaceholder}
                  disabled={disabled}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Party / name</Label>
                <Input
                  value={party}
                  onChange={(e) => onPartyChange(e.target.value)}
                  placeholder={partyPlaceholder}
                  disabled={disabled}
                  className="bg-background"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Responsibilities (one per line)</Label>
              <Textarea
                value={responsibilitiesText}
                onChange={(e) => {
                  const lines = e.target.value
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean);
                  onResponsibilitiesChange(lines);
                }}
                rows={3}
                placeholder={responsibilitiesPlaceholder}
                disabled={disabled}
                className="bg-muted/30 rounded-lg focus:ring-2 focus:ring-primary/20 border-border"
              />
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
