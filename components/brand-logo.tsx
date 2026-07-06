import * as React from "react"

import { cn } from "@/lib/utils"

interface BrandLogoMarkProps {
  className?: string
}

export function BrandLogoMark({ className }: BrandLogoMarkProps) {
  const reactId = React.useId().replace(/:/g, "")
  const surfaceId = `eatfear-surface-${reactId}`
  const signalId = `eatfear-signal-${reactId}`

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      className={cn("shrink-0", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={surfaceId} x1="14" x2="86" y1="10" y2="92" gradientUnits="userSpaceOnUse">
          <stop stopColor="#151D30" />
          <stop offset="1" stopColor="#0A0E19" />
        </linearGradient>
        <linearGradient id={signalId} x1="30" x2="74" y1="68" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F43F5E" />
          <stop offset="0.55" stopColor="#F59E0B" />
          <stop offset="1" stopColor="#10B981" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="26" fill={`url(#${surfaceId})`} />
      <path
        d="M28 44 L47 67 L74 30"
        stroke={`url(#${signalId})`}
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M58 30 H74 V46" stroke="#10B981" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="47" cy="67" r="6.5" fill="#0A0E19" stroke="#F8FAFC" strokeWidth="3.5" />
      <rect x="2" y="2" width="96" height="96" rx="24" stroke="#FFFFFF" strokeOpacity="0.10" strokeWidth="2" />
    </svg>
  )
}
