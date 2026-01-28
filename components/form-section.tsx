import * as React from "react"

import { cn } from "@/lib/utils"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type FormSectionProps = {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  contentClassName?: string
}

export function FormSection({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: FormSectionProps) {
  return (
    <Card
      className={cn(
        "gap-0 py-0 border-muted-foreground/15 shadow-sm",
        className
      )}
    >
      <CardHeader className="border-b border-muted-foreground/10 py-6">
        <div className="space-y-1">
          <CardTitle className="text-lg font-semibold">{title}</CardTitle>
          {description ? (
            <CardDescription className="text-sm text-muted-foreground">{description}</CardDescription>
          ) : null}
        </div>
        {actions ? <CardAction>{actions}</CardAction> : null}
      </CardHeader>
      <CardContent className={cn("py-6 space-y-4", contentClassName)}>{children}</CardContent>
    </Card>
  )
}

/** Nested group surface: rounded border and subtle background */
export function SubPanel({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-lg border border-muted-foreground/10 bg-background/60 p-4", className)}
      {...props}
    >
      {children}
    </div>
  )
}
