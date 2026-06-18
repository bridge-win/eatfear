import * as React from "react"

import { cn } from "@/lib/utils"

interface BrandLogoMarkProps {
  className?: string
}

export function BrandLogoMark({ className }: BrandLogoMarkProps) {
  const reactId = React.useId().replace(/:/g, "")
  const surfaceId = `eatfear-surface-${reactId}`
  const signalId = `eatfear-signal-${reactId}`
  const glowId = `eatfear-glow-${reactId}`

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 180 180"
      className={cn("shrink-0", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={surfaceId} x1="24" x2="156" y1="18" y2="164" gradientUnits="userSpaceOnUse">
          <stop stopColor="#172033" />
          <stop offset="0.45" stopColor="#070A12" />
          <stop offset="1" stopColor="#0D111C" />
        </linearGradient>
        <linearGradient id={signalId} x1="40" x2="141" y1="124" y2="55" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF4D5E" />
          <stop offset="0.47" stopColor="#FF9F43" />
          <stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
        <filter id={glowId} x="12" y="18" width="156" height="140" colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      <rect width="180" height="180" rx="42" fill={`url(#${surfaceId})`} />
      <path d="M22 92C49 61 87 47 158 42" stroke="#22D3EE" strokeOpacity="0.16" strokeWidth="2" />
      <path d="M26 126C59 99 98 88 154 91" stroke="#FF4D5E" strokeOpacity="0.14" strokeWidth="2" />
      <g filter={`url(#${glowId})`} opacity="0.75">
        <path d="M43 116L72 88L94 107L137 58" stroke={`url(#${signalId})`} strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <path
        d="M43 116L72 88L94 107L137 58"
        stroke={`url(#${signalId})`}
        strokeWidth="11"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M47 56H100M47 88H80M47 122H108" stroke="#F8FAFC" strokeOpacity="0.92" strokeWidth="12" strokeLinecap="round" />
      <path d="M43 116L72 88L94 107L137 58" stroke={`url(#${signalId})`} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="72" cy="88" r="8" fill="#070A12" stroke="#22D3EE" strokeWidth="5" />
      <circle cx="94" cy="107" r="8" fill="#070A12" stroke="#FF9F43" strokeWidth="5" />
      <circle cx="137" cy="58" r="8" fill="#070A12" stroke="#67E8F9" strokeWidth="5" />
      <rect x="6" y="6" width="168" height="168" rx="38" stroke="#FFFFFF" strokeOpacity="0.14" strokeWidth="3" />
    </svg>
  )
}
