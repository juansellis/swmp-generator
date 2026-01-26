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
    <Card className={cn("gap-0 py-0", className)}>
      <CardHeader className="border-b py-6">
        <div className="space-y-1">
          <CardTitle className="text-base">{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {actions ? <CardAction>{actions}</CardAction> : null}
      </CardHeader>
      <CardContent className={cn("py-6", contentClassName)}>{children}</CardContent>
    </Card>
  )
}
