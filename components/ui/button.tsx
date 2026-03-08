import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 aria-invalid:ring-destructive/20",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary/30 active:bg-primary/80 disabled:opacity-50",
        primary:
          "bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary/30 active:bg-primary/80 disabled:opacity-50",
        destructive:
          "border border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/30 active:bg-destructive/80 disabled:opacity-50",
        outline:
          "border border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring active:bg-muted disabled:opacity-50",
        secondary:
          "border border-border/60 bg-secondary text-secondary-foreground hover:bg-secondary/80 focus-visible:ring-ring/30 active:bg-muted disabled:opacity-50",
        ghost:
          "bg-transparent text-foreground hover:bg-accent focus-visible:ring-ring active:bg-accent disabled:opacity-50",
        link: "text-primary underline-offset-4 hover:underline active:opacity-80",
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
