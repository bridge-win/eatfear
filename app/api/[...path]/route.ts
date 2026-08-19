import { NextResponse } from "next/server"

type HttpMethod = "GET" | "POST"
type RouteParams = Record<string, string>
type RouteContext = { params: Promise<RouteParams> }
type CatchAllContext = { params: Promise<{ path?: string | string[] }> }
type RouteHandler = (request: Request, context: RouteContext) => Response | Promise<Response>
type RouteModule = Partial<Record<HttpMethod, unknown>>
type ModuleLoader = () => Promise<RouteModule>

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 10

const routeLoaders: Record<string, ModuleLoader> = {
  "alerts/dispatch": () => import("@/lib/api-routes/alerts/dispatch/route").then((module) => module as RouteModule),
  "check-alerts": () => import("@/lib/api-routes/check-alerts/route").then((module) => module as RouteModule),
  "crypto/binance": () => import("@/lib/api-routes/crypto/binance/route").then((module) => module as RouteModule),
  "crypto/black-swan": () => import("@/lib/api-routes/crypto/black-swan/route").then((module) => module as RouteModule),
  "crypto/btc-derivatives": () => import("@/lib/api-routes/crypto/btc-derivatives/route").then((module) => module as RouteModule),
  "crypto/buy-window": () => import("@/lib/api-routes/crypto/buy-window/route").then((module) => module as RouteModule),
  "crypto/coingecko": () => import("@/lib/api-routes/crypto/coingecko/route").then((module) => module as RouteModule),
  "crypto/cycle-position": () => import("@/lib/api-routes/crypto/cycle-position/route").then((module) => module as RouteModule),
  "crypto/euphoria": () => import("@/lib/api-routes/crypto/euphoria/route").then((module) => module as RouteModule),
  "crypto/history-compare": () => import("@/lib/api-routes/crypto/history-compare/route").then((module) => module as RouteModule),
  "crypto/instruments": () => import("@/lib/api-routes/crypto/instruments/route").then((module) => module as RouteModule),
  "crypto/market-collector": () => import("@/lib/api-routes/crypto/market-collector/route").then((module) => module as RouteModule),
  "crypto/markets": () => import("@/lib/api-routes/crypto/markets/route").then((module) => module as RouteModule),
  "crypto/mining-cost": () => import("@/lib/api-routes/crypto/mining-cost/route").then((module) => module as RouteModule),
  "crypto/options-oi": () => import("@/lib/api-routes/crypto/options-oi/route").then((module) => module as RouteModule),
  "crypto/regime-score": () => import("@/lib/api-routes/crypto/regime-score/route").then((module) => module as RouteModule),
  "crypto/signal-backtest": () => import("@/lib/api-routes/crypto/signal-backtest/route").then((module) => module as RouteModule),
  "crypto/smart-money": () => import("@/lib/api-routes/crypto/smart-money/route").then((module) => module as RouteModule),
  "crypto/smart-money/discovery": () => import("@/lib/api-routes/crypto/smart-money/discovery/route").then((module) => module as RouteModule),
  "crypto/smart-money/feed": () => import("@/lib/api-routes/crypto/smart-money/feed/route").then((module) => module as RouteModule),
  "crypto/smart-money/health": () => import("@/lib/api-routes/crypto/smart-money/health/route").then((module) => module as RouteModule),
  "crypto/smart-money/intelligence": () => import("@/lib/api-routes/crypto/smart-money/intelligence/route").then((module) => module as RouteModule),
  "crypto/smart-money/leader-detail": () => import("@/lib/api-routes/crypto/smart-money/leader-detail/route").then((module) => module as RouteModule),
  "crypto/smart-money/leaders": () => import("@/lib/api-routes/crypto/smart-money/leaders/route").then((module) => module as RouteModule),
  "crypto/smart-money/positioning": () => import("@/lib/api-routes/crypto/smart-money/positioning/route").then((module) => module as RouteModule),
  "crypto/smart-money/verification": () => import("@/lib/api-routes/crypto/smart-money/verification/route").then((module) => module as RouteModule),
  "crypto/smart-money/wallet": () => import("@/lib/api-routes/crypto/smart-money/wallet/route").then((module) => module as RouteModule),
  "macro": () => import("@/lib/api-routes/macro/route").then((module) => module as RouteModule),
  "news": () => import("@/lib/api-routes/news/route").then((module) => module as RouteModule),
  "send-immediate-alert": () => import("@/lib/api-routes/send-immediate-alert/route").then((module) => module as RouteModule),
  "send-test-alert": () => import("@/lib/api-routes/send-test-alert/route").then((module) => module as RouteModule),
  "stock-price": () => import("@/lib/api-routes/stock-price/route").then((module) => module as RouteModule),
  "stock-quotes": () => import("@/lib/api-routes/stock-quotes/route").then((module) => module as RouteModule),
  "stock-sparklines": () => import("@/lib/api-routes/stock-sparklines/route").then((module) => module as RouteModule),
  "stock/panic-signal": () => import("@/lib/api-routes/stock/panic-signal/route").then((module) => module as RouteModule),
  "telegram/[secret]": () => import("@/lib/api-routes/telegram/[secret]/route").then((module) => module as RouteModule),
}

function normalizePath(path: string[]): { key: string; params: RouteParams } {
  if (path.length === 2 && path[0] === "telegram") {
    return { key: "telegram/[secret]", params: { secret: path[1] ?? "" } }
  }

  return { key: path.join("/"), params: {} }
}

function isRouteHandler(value: unknown): value is RouteHandler {
  return typeof value === "function"
}

async function dispatch(request: Request, context: CatchAllContext, method: HttpMethod): Promise<Response> {
  const path = (await context.params).path
  const segments = Array.isArray(path) ? path : typeof path === "string" ? [path] : []
  const { key, params } = normalizePath(segments)
  const loadModule = routeLoaders[key]

  if (!loadModule) {
    return NextResponse.json({ error: "API route not found" }, { status: 404 })
  }

  const module = await loadModule()
  const handler = module[method]

  if (!isRouteHandler(handler)) {
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 })
  }

  return handler(request, { params: Promise.resolve(params) })
}

export function GET(request: Request, context: CatchAllContext): Promise<Response> {
  return dispatch(request, context, "GET")
}

export function POST(request: Request, context: CatchAllContext): Promise<Response> {
  return dispatch(request, context, "POST")
}
