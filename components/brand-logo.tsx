import { cn } from "@/lib/utils"

interface BrandLogoMarkProps {
  className?: string
}

function BrandLogoMark({ className }: BrandLogoMarkProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      className={cn("shrink-0 text-orange-500", className)}
      fill="none"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 39 42 77 88 21M67 21h21v21"
        stroke="currentColor"
        strokeWidth="12"
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
