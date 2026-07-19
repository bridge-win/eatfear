import { SmartMoneyCopyDashboard } from "@/components/smart-money-copy-dashboard"

// Same pattern as /crypto: static shell, client-side hydration keeps navigation instant.
export const dynamic = "force-static"

export default function SmartMoneyPage() {
  return <SmartMoneyCopyDashboard />
}
