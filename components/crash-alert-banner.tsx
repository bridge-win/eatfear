import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle } from "lucide-react"
import type { CrashAlert } from "@/lib/types"

interface CrashAlertBannerProps {
  crashes: CrashAlert[]
}

export function CrashAlertBanner({ crashes }: CrashAlertBannerProps) {
  if (crashes.length === 0) return null

  return (
    <div className="space-y-3">
      {crashes.map((crash, index) => (
        <Alert key={`${crash.symbol}-${crash.timeframe}-${index}`} variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="font-semibold">
            {crash.name} Crash Detected - {crash.timeframe}
          </AlertTitle>
          <AlertDescription>
            {crash.name} ({crash.symbol}) has dropped {crash.dropPercentage.toFixed(2)}% in the last {crash.timeframe}.
            Current price: ${crash.currentPrice.toLocaleString()}
          </AlertDescription>
        </Alert>
      ))}
    </div>
  )
}
