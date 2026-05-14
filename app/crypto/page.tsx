import { CryptoDashboard } from "@/components/crypto-dashboard"

// Render the dashboard shell immediately; client-side useEffects hydrate data.
// (Server-side fetches were removed so tab navigation is instant.)
export const dynamic = "force-static"

export default function CryptoPage() {
  return <CryptoDashboard />
}
