import * as React from "react"

import { cn } from "@/lib/utils"
import { Logo } from "@/components/brand/logo"

type AppShellProps = {
  children: React.ReactNode
  topNav?: React.ReactNode
  className?: string
  containerClassName?: string
  hideHeader?: boolean
  /** When true (e.g. login), page has solid background instead of tinted */
  noPageTint?: boolean
}

export function AppShell({
  children,
  topNav,
  className,
  containerClassName,
  hideHeader = false,
  noPageTint = false,
}: AppShellProps) {
  return (
    <div
      className={cn(
        "min-h-screen text-foreground",
        noPageTint ? "bg-background" : "bg-slate-50",
        className
      )}
    >
      {!hideHeader ? (
        <div className="sticky top-0 z-10 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className={cn("mx-auto w-full max-w-[1200px] px-6 py-3", containerClassName)}>
            <div className="flex items-center gap-4">
              <Logo height={36} href="/projects" className="h-9 w-auto" />
              {topNav ? <div className="flex-1">{topNav}</div> : null}
            </div>
          </div>
        </div>
      ) : null}

      <main className={cn("flex-1", className)}>
        <div
          className={cn("mx-auto w-full max-w-[1200px] px-6 py-6 space-y-6", containerClassName)}
        >
          {children}
        </div>
      </main>
    </div>
  )
}
