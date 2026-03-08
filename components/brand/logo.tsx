import Image from "next/image"
import Link from "next/link"
import * as React from "react"
import { cn } from "@/lib/utils"

/** Blueprint logo aspect ratio (width / height) — horizontal pill shape */
const LOGO_ASPECT = 4.5

type LogoProps = {
  className?: string
  /** Height in pixels; used with width to preserve aspect ratio */
  height?: number
  /** Width in pixels; if omitted, derived from height */
  width?: number
  href?: string
}

export function Logo({ className, height, width, href }: LogoProps) {
  const logoHeight = height ?? 36
  const logoWidth = width ?? Math.round(logoHeight * LOGO_ASPECT)

  const logoContent = (
    <Image
      src="/brand/blueprint-logo.png"
      alt="Blueprint"
      width={logoWidth}
      height={logoHeight}
      priority
      unoptimized
      className={cn("object-contain max-w-full", className)}
      style={{ background: "transparent" }}
    />
  )

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center shrink-0 min-w-0 [&_img]:bg-transparent">
        {logoContent}
      </Link>
    )
  }

  return (
    <div className="inline-flex items-center shrink-0 min-w-0 [&_img]:bg-transparent">
      {logoContent}
    </div>
  )
}
