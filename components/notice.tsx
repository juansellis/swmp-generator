import * as React from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

type NoticeProps = {
  type: "success" | "error" | "info"
  title?: string
  message: string
  className?: string
}

export function Notice({ type, title, message, className }: NoticeProps) {
  const styles = {
    success:
      "border-emerald-200 bg-emerald-50 text-emerald-900 [&_[data-slot=alert-description]]:text-emerald-800",
    error:
      "border-red-200 bg-red-50 text-red-900 [&_[data-slot=alert-description]]:text-red-800",
    info: "border-slate-200 bg-slate-50 text-slate-900",
  }

  return (
    <Alert className={cn(styles[type], className)}>
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}
