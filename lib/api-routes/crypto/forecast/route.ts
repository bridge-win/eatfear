import { NextResponse } from "next/server"

import { fetchOkxDailyCandles } from "@/lib/okx-history"
import { forecast, type HorizonForecast } from "@/lib/research/forecast"

export const runtime = "nodejs"

const HORIZONS = [30, 60, 90] as const
// OKX BTC-USDT daily history starts 2017-10; the selection window needs 2019+ with a
// year of warm-up before it, so request everything the exchange has.
const DAYS_WANTED = 3400
const SELECTION_YEARS: [number, number] = [2019, 2022]
const HOLDOUT_FROM = 2023
const REVALIDATE_SECONDS = 6 * 3600

export interface ForecastResponse {
  ccy: string
  asOf: string
  spot: number
  candles: number
  firstCandle: string
  horizons: Record<string, HorizonForecast>
  methodology: string
  caveats: string[]
}

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url)
  const ccy = (url.searchParams.get("ccy") ?? "BTC").toUpperCase()
  const instId = `${ccy}-USDT`

  const candles = await fetchOkxDailyCandles({ instId, daysWanted: DAYS_WANTED, revalidateSeconds: REVALIDATE_SECONDS })
  // The forecast only reads closes, but the last bar must be a completed UTC day or the
  // "as of" price would be an intraday snapshot presented as a close.
  const completed = candles.filter((c) => c.timestamp < Date.now() - Date.now() % 86_400_000)
  if (completed.length < 1200) {
    return NextResponse.json({ error: `insufficient history for ${instId}: ${completed.length} daily candles` }, { status: 503 })
  }
  const series = completed.map((c) => ({ time: c.timestamp, close: c.close }))

  const horizons: Record<string, HorizonForecast> = {}
  for (const h of HORIZONS) horizons[String(h)] = forecast(series, h, SELECTION_YEARS, HOLDOUT_FROM)

  const body: ForecastResponse = {
    ccy,
    asOf: horizons["30"].asOf,
    spot: horizons["30"].spot,
    candles: series.length,
    firstCandle: new Date(series[0].time).toISOString().slice(0, 10),
    horizons,
    methodology:
      "中位数 = 当前价(零漂移,方向在样本外不可预测);宽度来自波动率模型(const/rv30/ewma/HAR 与等权组合,按选择窗与留出窗 QLIKE 赢家是否一致决定);形状取训练窗标准化收益的经验分位,保留胖尾。",
    caveats: [
      "留出窗覆盖率是历史校准,不是对未来的保证;60/90 日的有效样本很小,区间边缘噪声大",
      "1 至 (视角-1) 日的分位带按 √(h/H) 缩放,为近似;最后一日为精确经验分位",
      "未计资金费率、借币成本与交易所风险",
    ],
  }
  return NextResponse.json(body, { headers: { "Cache-Control": `public, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=3600` } })
}
