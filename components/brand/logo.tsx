import Image from "next/image"
import Link from "next/link"
import * as React from "react"
import { cn } from "@/lib/utils"

type LogoProps = {
  className?: string
  height?: number
  width?: number
  href?: string
}

export function Logo({ className, height, width, href }: LogoProps) {
  const logoHeight = height ?? 32
  // Default to a reasonable width if not provided (assuming roughly 3:1 aspect ratio for logo)
  const logoWidth = width ?? (logoHeight * 3)

  const logoContent = (
    <Image
      src="/wastex-logo.svg"
      alt="WasteX"
      height={logoHeight}
      width={logoWidth}
      className={cn("h-auto w-auto", className)}
      priority
      unoptimized
    />
  )

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center">
        {logoContent}
      </Link>
    )
  }

  return <div className="inline-flex items-center">{logoContent}</div>
}
