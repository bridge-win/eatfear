import { StockDashboard } from "@/components/stock-dashboard"

// Render the dashboard shell immediately; client effects load quotes + macro KPIs.
export const dynamic = "force-static"

export default function StockPage() {
  return <StockDashboard />
}
