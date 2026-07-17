import { cn } from "@/lib/utils"

interface BrandLogoMarkProps {
  className?: string
}

function BrandLogoMark({ className }: BrandLogoMarkProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 64 64"
      className={cn("shrink-0", className)}
      fill="none"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="ef-tile" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1C1F31" />
          <stop offset="0.55" stopColor="#12141F" />
          <stop offset="1" stopColor="#0A0B12" />
        </linearGradient>
        <linearGradient id="ef-rim" x1="32" y1="0" x2="32" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.28" />
          <stop offset="0.4" stopColor="#FFFFFF" stopOpacity="0.06" />
          <stop offset="1" stopColor="#A855F7" stopOpacity="0.25" />
        </linearGradient>
        <linearGradient id="ef-pulse" x1="11" y1="32" x2="53" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FBBF24" />
          <stop offset="0.35" stopColor="#F97316" />
          <stop offset="0.68" stopColor="#F43F5E" />
          <stop offset="1" stopColor="#A855F7" />
        </linearGradient>
        <radialGradient id="ef-glow" cx="32" cy="31" r="27" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F43F5E" stopOpacity="0.32" />
          <stop offset="0.6" stopColor="#F97316" stopOpacity="0.12" />
          <stop offset="1" stopColor="#F97316" stopOpacity="0" />
        </radialGradient>
        <filter id="ef-blur" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.6" />
        </filter>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#ef-tile)" />
      <rect width="64" height="64" rx="15" fill="url(#ef-glow)" />
      <rect x="0.75" y="0.75" width="62.5" height="62.5" rx="14.25" stroke="url(#ef-rim)" strokeWidth="1.5" />
      <path
        d="M12 32h9.5l5-10.5 7.5 21 5-10.5H52"
        stroke="url(#ef-pulse)"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.55"
        filter="url(#ef-blur)"
      />
      <path
        d="M12 32h9.5l5-10.5 7.5 21 5-10.5H52"
        stroke="url(#ef-pulse)"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

interface BrandLogoProps {
  className?: string
  markClassName?: string
}

export function BrandLogo({ className, markClassName }: BrandLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-[0.4em]", className)}>
      <BrandLogoMark className={cn("h-[1.15em] w-[1.15em]", markClassName)} />
      <span className="font-bold tracking-[-0.035em]">eatfear</span>
    </span>
  )
}
