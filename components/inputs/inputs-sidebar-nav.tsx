"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SectionItem {
  id: string;
  label: string;
}

const DEFAULT_SECTIONS: SectionItem[] = [
  { id: "project-overview", label: "Project Overview" },
  { id: "primary-waste-contractor", label: "Primary Waste Contractor" },
  { id: "site-and-facilities", label: "Site & Facilities" },
  { id: "waste-streams", label: "Waste Streams" },
  { id: "resource-inputs", label: "Resource Inputs" },
  { id: "compliance-notes", label: "Compliance & Notes" },
];

export interface InputsSidebarNavProps {
  sections?: SectionItem[];
  activeId?: string | null;
  className?: string;
}

export function InputsSidebarNav({
  sections = DEFAULT_SECTIONS,
  activeId,
  className,
}: InputsSidebarNavProps) {
  const [currentActive, setCurrentActive] = React.useState<string | null>(activeId ?? null);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setCurrentActive(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    );

    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [sections]);

  const active = activeId ?? currentActive;

  return (
    <nav
      aria-label="Inputs sections"
      className={cn("sticky top-24 space-y-1", className)}
    >
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 mb-3">
        Sections
      </p>
      <ul className="space-y-0.5">
        {sections.map(({ id, label }) => (
          <li key={id}>
            <a
              href={`#${id}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
              }}
              className={cn(
                "block rounded-md px-3 py-2 text-sm transition-colors",
                active === id
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
