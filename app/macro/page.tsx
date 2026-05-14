import { MacroDashboard } from "@/components/macro-dashboard"

// Render the dashboard shell immediately; the client effect fetches `/api/macro`.
export const dynamic = "force-static"

export default function MacroPage() {
  return <MacroDashboard />
}
