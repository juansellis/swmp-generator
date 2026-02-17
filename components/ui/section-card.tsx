import * as React from "react"
import { cn } from "@/lib/utils"

type SectionCardProps = {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  contentClassName?: string
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: SectionCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden",
        className
      )}
    >
      <div className="border-b border-border/50 bg-card px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      </div>
      <div className={cn("px-6 py-6 space-y-4", contentClassName)}>{children}</div>
    </div>
  )
}
