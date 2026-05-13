import { fetchJson } from "@/lib/data-sources/_fetch"

interface TradeVolRow {
  currency?: string
  puts_volume_7d?: number
  calls_volume_7d?: number
}

interface DeribitTradeVolEnvelope {
  result?: TradeVolRow[]
}

/** Deribit public option volume split — venue-reported aggregates. */
export async function fetchBtcOptionPutCallRatio7d(revalidate = 120): Promise<number | null> {
  const envelope = await fetchJson<DeribitTradeVolEnvelope>(
    "https://www.deribit.com/api/v2/public/get_trade_volumes?currency=BTC&kind=option&extended=true",
    { revalidate, timeoutMs: 12_000 },
  )

  const row = envelope?.result?.find((r) => r.currency === "BTC")
  const pu = Number(row?.puts_volume_7d)
  const cu = Number(row?.calls_volume_7d)

  if (!Number.isFinite(pu) || !Number.isFinite(cu) || cu <= 0) return null
  return pu / cu
}
