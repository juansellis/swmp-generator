"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useProjectContext } from "@/app/projects/[id]/project-context";
import { cn } from "@/lib/utils";

export type ReportSection = "overview" | "strategy" | "streams" | "narrative" | "carbon" | "appendix";

const SECTIONS: { key: ReportSection; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "strategy", label: "Strategy" },
  { key: "streams", label: "Waste Streams" },
  { key: "carbon", label: "Carbon Forecast" },
  { key: "narrative", label: "Narrative" },
  { key: "appendix", label: "Appendix" },
];

export function ReportSectionHeader({
  currentSection,
  exportMode,
}: {
  currentSection: ReportSection;
  exportMode: boolean;
}) {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const projectId = params?.id;
  const ctx = useProjectContext();
  const project = ctx?.project ?? null;
  const base = `/projects/${projectId}/swmp`;
  const address = project?.address ?? project?.site_address ?? null;

  return (
    <header
      className={cn(
        "sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 print:static print:border print:bg-white",
        !exportMode && "shadow-sm"
      )}
    >
      <div className="max-w-5xl mx-auto px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between flex-wrap">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {project?.name ?? "Project"}
            </p>
            {address && (
              <p className="text-xs text-muted-foreground truncate">{address}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {!exportMode && (
              <nav
                className="flex items-center gap-1 rounded-lg bg-muted/50 p-1"
                aria-label="Report sections"
              >
                {SECTIONS.map(({ key, label }) => {
                  const isActive = currentSection === key;
                  const next = new URLSearchParams(searchParams.toString());
                  next.set("section", key);
                  const href = `${base}?${next.toString()}`;
                  return (
                    <Link
                      key={key}
                      href={href}
                      className={cn(
                        "inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                        isActive
                          ? "bg-background text-primary shadow-[var(--shadow-card)] font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      {label}
                    </Link>
                  );
                })}
              </nav>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export { SECTIONS };
