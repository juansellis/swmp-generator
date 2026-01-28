import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 aria-invalid:ring-destructive/20",
  {
    variants: {
      variant: {
        default:
          "bg-black text-white hover:bg-black/90 focus-visible:ring-slate-400 active:bg-black/80 disabled:opacity-50",
        primary:
          "bg-black text-white hover:bg-black/90 focus-visible:ring-slate-400 active:bg-black/80 disabled:opacity-50",
        destructive:
          "border border-red-600 bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-400 active:bg-red-800 disabled:opacity-50",
        outline:
          "border border-slate-300 bg-white text-slate-900 hover:bg-black hover:text-white hover:border-black focus-visible:ring-slate-400 active:bg-slate-800 active:text-white disabled:opacity-50",
        secondary:
          "border border-slate-200 bg-slate-100 text-slate-900 hover:bg-slate-200 focus-visible:ring-slate-400 active:bg-slate-300 disabled:opacity-50",
        ghost:
          "bg-transparent text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-400 active:bg-slate-200 disabled:opacity-50",
        link: "text-slate-900 underline-offset-4 hover:underline active:opacity-80",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
