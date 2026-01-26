import * as React from "react"

import { cn } from "@/lib/utils"
import { Logo } from "@/components/brand/logo"

type AppShellProps = {
  children: React.ReactNode
  topNav?: React.ReactNode
  className?: string
  containerClassName?: string
  hideHeader?: boolean
}

export function AppShell({
  children,
  topNav,
  className,
  containerClassName,
  hideHeader = false,
}: AppShellProps) {
  return (
    <div className={cn("min-h-screen bg-background text-foreground", className)}>
      {!hideHeader ? (
        <div className="border-b bg-background">
          <div className={cn("mx-auto w-full max-w-6xl px-4 py-3 sm:px-6", containerClassName)}>
            <div className="flex items-center gap-4">
              <Logo height={36} href="/projects" className="h-9 w-auto" />
              {topNav ? <div className="flex-1">{topNav}</div> : null}
            </div>
          </div>
        </div>
      ) : null}

      <main className={cn("mx-auto w-full max-w-6xl px-4 py-8 sm:px-6", containerClassName)}>
        {children}
      </main>
    </div>
  )
}
