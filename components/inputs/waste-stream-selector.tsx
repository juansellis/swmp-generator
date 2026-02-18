"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { XIcon, ChevronDownIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const MAX_SUGGESTIONS = 8;

export interface WasteStreamSelectorProps {
  /** Current search query */
  search: string;
  onSearchChange: (value: string) => void;
  /** All available stream names from catalog */
  library: string[];
  /** Currently selected stream names */
  selected: string[];
  onAddStream: (stream: string) => void;
  onRemoveStream: (stream: string) => void;
  onApplyTemplate: () => void;
  onAddCommonSet: () => void;
  onContinueToPlanning: () => void;
  /** Whether project type has a template (show Apply template) */
  hasTemplate: boolean;
  disabled?: boolean;
  /** Optional class for container */
  className?: string;
}

/**
 * Stage 1 — Select waste streams: search, recommended actions, selected chips, CTA to planning.
 */
export function WasteStreamSelector({
  search,
  onSearchChange,
  library,
  selected,
  onAddStream,
  onRemoveStream,
  onApplyTemplate,
  onAddCommonSet,
  onContinueToPlanning,
  hasTemplate,
  disabled = false,
  className,
}: WasteStreamSelectorProps) {
  const [addOpen, setAddOpen] = React.useState(false);
  const searchLower = search.trim().toLowerCase();
  const available = React.useMemo(
    () =>
      library
        .filter(
          (w) =>
            !selected.includes(w) &&
            (searchLower === "" || w.toLowerCase().includes(searchLower))
        )
        .slice(0, MAX_SUGGESTIONS),
    [library, selected, searchLower]
  );

  return (
    <div className={cn("space-y-4", className)}>
      <p className="text-sm font-medium text-muted-foreground">
        Select waste streams for this project
      </p>

      <div className="flex flex-wrap gap-2 items-center">
        <Popover open={addOpen} onOpenChange={setAddOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="default"
              disabled={disabled}
              className="min-w-[200px] justify-between"
            >
              <span className="truncate">
                {search.trim() ? `Search: "${search.trim()}"` : "Add stream…"}
              </span>
              <ChevronDownIcon className="size-4 shrink-0 ml-2" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2" align="start">
            <Input
              placeholder="Search streams…"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="mb-2"
              autoFocus
            />
            <ul className="max-h-[240px] overflow-auto">
              {available.length === 0 ? (
                <li className="px-2 py-2 text-sm text-muted-foreground">
                  {selected.length >= library.length
                    ? "All streams added"
                    : search.trim()
                      ? "No matching streams"
                      : "Type to search"}
                </li>
              ) : (
                available.map((w) => (
                  <li key={w}>
                    <button
                      type="button"
                      onClick={() => {
                        onAddStream(w);
                        onSearchChange("");
                        setAddOpen(false);
                      }}
                      className="w-full text-left px-2 py-2 text-sm rounded-md hover:bg-muted"
                    >
                      {w}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </PopoverContent>
        </Popover>

        {hasTemplate && (
          <Button
            type="button"
            variant="outline"
            size="default"
            disabled={disabled}
            onClick={onApplyTemplate}
          >
            Apply template
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="default"
          disabled={disabled}
          onClick={onAddCommonSet}
        >
          Add common set
        </Button>
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((s) => (
            <Badge
              key={s}
              variant="secondary"
              className="flex items-center gap-2 px-3 py-1.5 bg-muted border border-border rounded-full"
            >
              <span>{s}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onRemoveStream(s)}
                className="ml-1 h-5 w-5 rounded-full p-0"
                aria-label={`Remove ${s}`}
                title="Remove"
              >
                <XIcon className="size-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}

      {selected.length > 0 && (
        <Button
          type="button"
          onClick={onContinueToPlanning}
          className="w-full sm:w-auto"
        >
          Continue to planning
        </Button>
      )}
    </div>
  );
}
