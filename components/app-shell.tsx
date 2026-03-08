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
        noPageTint ? "bg-background" : "bg-[var(--background-subtle)]",
        className
      )}
    >
      {!hideHeader ? (
        <header
          className="sticky top-0 z-10 bg-[var(--header-bg)] border-b border-[var(--header-border)] shadow-[0_1px_0_0_var(--header-border)] backdrop-blur-sm"
          role="banner"
        >
          <div className={cn("mx-auto w-full max-w-[1200px] px-4 sm:px-6 py-3", containerClassName)}>
            <div className="flex items-center gap-6 sm:gap-8 min-w-0">
              <Logo
                height={36}
                href="/projects"
                className="h-8 w-auto max-w-[140px] sm:max-w-[180px] shrink-0"
              />
              {topNav ? <div className="flex-1 min-w-0">{topNav}</div> : null}
            </div>
          </div>
        </header>
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
