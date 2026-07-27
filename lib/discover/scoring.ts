import type {
  DiscoverCandidate,
  DiscoverRiskBand,
  DiscoverStrategy,
  DiscoverUniverseEntry,
  StableYieldAsset,
  StableYieldAssetEntry,
  StableYieldIdea,
} from "./types.ts"
import { DISCOVER_TARGET_DAYS_TO_EXPIRATION } from "./universe.ts"

const TRADING_DAYS_PER_YEAR = 252
const CALENDAR_DAYS_PER_YEAR = 365

export interface PriceHistoryPoint {
  timestamp: number
  close: number
  volume: number
}

export interface CandidateInput {
  entry: DiscoverUniverseEntry
  history: PriceHistoryPoint[]
  price: number
  previousClose: number
  asOf: number
  riskFreeRatePct: number
  optionQuote?: CandidateOptionQuote | null
}

export interface CandidateOptionQuote {
  optionSymbol: string
  expirationDate: string
  daysToExpiration: number
  strike: number
  bid: number
  ask: number
  volume: number
  openInterest: number
  quoteTime: number
  sourceUrl: string
}

export interface StableYieldAssetInput {
  entry: StableYieldAssetEntry
  history: PriceHistoryPoint[]
  price: number
  previousClose: number
  asOf: number
  treasuryBillProxyRatePct: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function erf(value: number): number {
  const sign = value < 0 ? -1 : 1
  const x = Math.abs(value)
  const t = 1 / (1 + 0.3275911 * x)
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)
  return sign * y
}

function normalCdf(value: number): number {
  return 0.5 * (1 + erf(value / Math.SQRT2))
}

export function calculateAnnualizedVolatility(history: PriceHistoryPoint[]): number {
  const returns: number[] = []
  for (let index = 1; index < history.length; index += 1) {
    const previous = history[index - 1]?.close
    const current = history[index]?.close
    if (!previous || !current || previous <= 0 || current <= 0) continue
    returns.push(Math.log(current / previous))
  }
  if (returns.length < 30) return 0
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1)
  return Math.sqrt(variance) * Math.sqrt(TRADING_DAYS_PER_YEAR)
}

export function calculateMaxDrawdownPct(history: PriceHistoryPoint[]): number {
  let peak = 0
  let maxDrawdown = 0
  for (const point of history) {
    if (point.close <= 0) continue
    peak = Math.max(peak, point.close)
    if (peak === 0) continue
    maxDrawdown = Math.max(maxDrawdown, (peak - point.close) / peak)
  }
  return maxDrawdown * 100
}

export function calculateTrendScore(history: PriceHistoryPoint[], price: number): number {
  const closes = history.map((point) => point.close).filter((value) => value > 0)
  const latest50 = closes.slice(-50)
  const latest200 = closes.slice(-200)
  if (latest50.length < 20 || latest200.length < 80) return 45
  const sma50 = latest50.reduce((sum, value) => sum + value, 0) / latest50.length
  const sma200 = latest200.reduce((sum, value) => sum + value, 0) / latest200.length
  const oneYearLow = Math.min(...closes)
  const lowDistancePct = oneYearLow > 0 ? ((price - oneYearLow) / oneYearLow) * 100 : 0
  let score = 40
  if (price > sma200) score += 20
  if (sma50 > sma200) score += 15
  if (price > sma50) score += 10
  if (lowDistancePct > 15) score += 10
  if (price < sma200 * 0.9) score -= 20
  return clamp(score, 0, 100)
}

function calculateRiskScore(input: CandidateInput, volatilityPct: number, maxDrawdownPct: number, trendScore: number): number {
  const avgVolume = input.history.slice(-60).reduce((sum, point) => sum + point.volume, 0) / Math.max(1, input.history.slice(-60).length)
  const qualityBonus = {
    broad_index: 18,
    sector_etf: 12,
    cash_etf: 20,
    mega_cap: 12,
    dividend_quality: 10,
  }[input.entry.quality]
  const volatilityPenalty = clamp((volatilityPct - 18) * 1.15, 0, 35)
  const drawdownPenalty = clamp((maxDrawdownPct - 18) * 0.9, 0, 32)
  const liquidityBonus = avgVolume > 8_000_000 ? 12 : avgVolume > 2_000_000 ? 8 : avgVolume > 500_000 ? 4 : 0
  const pricePenalty = input.price < 25 ? 10 : 0
  return round(clamp(58 + qualityBonus + liquidityBonus + (trendScore - 50) * 0.18 - volatilityPenalty - drawdownPenalty - pricePenalty, 0, 100), 0)
}

function riskBand(score: number): DiscoverRiskBand {
  if (score >= 76) return "low"
  if (score >= 58) return "moderate"
  return "elevated"
}

function blackScholesPremium({
  strategy,
  spot,
  strike,
  years,
  volatility,
  riskFreeRate,
}: {
  strategy: DiscoverStrategy
  spot: number
  strike: number
  years: number
  volatility: number
  riskFreeRate: number
}): number {
  if (spot <= 0 || strike <= 0 || years <= 0 || volatility <= 0) return 0
  const sqrtTime = Math.sqrt(years)
  const d1 = (Math.log(spot / strike) + (riskFreeRate + (volatility ** 2) / 2) * years) / (volatility * sqrtTime)
  const d2 = d1 - volatility * sqrtTime
  if (strategy === "covered_call") {
    return spot * normalCdf(d1) - strike * Math.exp(-riskFreeRate * years) * normalCdf(d2)
  }
  return strike * Math.exp(-riskFreeRate * years) * normalCdf(-d2) - spot * normalCdf(-d1)
}

function targetBuffer(entry: DiscoverUniverseEntry, strategy: DiscoverStrategy, volatility: number): number {
  const base = entry.assetType === "ETF" ? 0.035 : 0.045
  const volComponent = volatility * Math.sqrt(DISCOVER_TARGET_DAYS_TO_EXPIRATION / CALENDAR_DAYS_PER_YEAR) * 0.35
  const strategyAdjustment = strategy === "cash_secured_put" ? 0.0025 : 0
  return clamp(base + volComponent + strategyAdjustment, 0.035, entry.assetType === "ETF" ? 0.09 : 0.12)
}

function nextExpirationDate(daysToExpiration = DISCOVER_TARGET_DAYS_TO_EXPIRATION): string {
  const date = new Date(Date.now() + daysToExpiration * 86_400_000)
  const day = date.getUTCDay()
  const daysUntilFriday = (5 - day + 7) % 7
  date.setUTCDate(date.getUTCDate() + daysUntilFriday)
  return date.toISOString().slice(0, 10)
}

function buildReasons({
  strategy,
  input,
  annualizedYieldPct,
  bufferPct,
  volatilityPct,
  maxDrawdownPct,
  trendScore,
  riskScore,
  premiumSource,
}: {
  strategy: DiscoverStrategy
  input: CandidateInput
  annualizedYieldPct: number
  bufferPct: number
  volatilityPct: number
  maxDrawdownPct: number
  trendScore: number
  riskScore: number
  premiumSource: "model_estimate" | "live_chain"
}): string[] {
  const action = strategy === "cash_secured_put" ? "put sale" : "covered-call sale"
  const yieldSource = premiumSource === "live_chain" ? "delayed-chain bid" : "modeled"
  return [
    `${round(annualizedYieldPct, 1)}% ${yieldSource} annualized option income clears the 10% first-pass hurdle.`,
    `${round(bufferPct, 1)}% ${strategy === "cash_secured_put" ? "downside" : "upside"} buffer before the selected strike is reached.`,
    `${input.entry.quality.replace("_", " ")} underlying with a ${riskScore}/100 risk score keeps premium from being the only reason.`,
    `One-year realized volatility is ${round(volatilityPct, 1)}% and max drawdown is ${round(maxDrawdownPct, 1)}%, which frames the ${action} risk.`,
    `Trend score ${round(trendScore, 0)}/100 helps avoid selling income into a clearly broken chart.`,
  ]
}

function buildCautions(
  strategy: DiscoverStrategy,
  maxDrawdownPct: number,
  premiumSource: "model_estimate" | "live_chain",
): string[] {
  const shared = [
    premiumSource === "live_chain"
      ? "Premium uses delayed Cboe bid data; confirm the executable bid/ask in your broker before trading."
      : "Premium is modeled from realized volatility, not a live option-chain bid/ask.",
    "Size each contract against the full 100-share obligation.",
  ]
  if (strategy === "cash_secured_put") {
    return [
      ...shared,
      "Assignment means buying the shares at strike even if the market falls further.",
      `The underlying has already shown a ${round(maxDrawdownPct, 1)}% one-year peak-to-trough drawdown.`,
    ]
  }
  return [
    ...shared,
    "Assignment caps upside above strike while the stock downside remains.",
    `A sharp selloff can erase many months of call premium; recent max drawdown was ${round(maxDrawdownPct, 1)}%.`,
  ]
}

export function buildCandidate(input: CandidateInput, strategy: DiscoverStrategy): DiscoverCandidate | null {
  if (input.history.length < 80 || input.price <= 0) return null
  const volatility = calculateAnnualizedVolatility(input.history)
  if (volatility <= 0) return null
  const volatilityPct = volatility * 100
  const maxDrawdownPct = calculateMaxDrawdownPct(input.history)
  const trendScore = calculateTrendScore(input.history, input.price)
  const score = calculateRiskScore(input, volatilityPct, maxDrawdownPct, trendScore)
  const buffer = targetBuffer(input.entry, strategy, volatility)
  const modeledStrike = strategy === "cash_secured_put"
    ? input.price * (1 - buffer)
    : input.price * (1 + buffer)
  const years = DISCOVER_TARGET_DAYS_TO_EXPIRATION / CALENDAR_DAYS_PER_YEAR
  const modeledPremium = blackScholesPremium({
    strategy,
    spot: input.price,
    strike: modeledStrike,
    years,
    volatility,
    riskFreeRate: input.riskFreeRatePct / 100,
  })
  const liveQuote = input.optionQuote
  const liveMid = liveQuote ? (liveQuote.bid + liveQuote.ask) / 2 : 0
  const liveSpreadPct = liveQuote && liveMid > 0 ? ((liveQuote.ask - liveQuote.bid) / liveMid) * 100 : null
  const canUseLiveQuote =
    liveQuote !== undefined &&
    liveQuote !== null &&
    liveQuote.bid > 0 &&
    liveQuote.ask >= liveQuote.bid &&
    liveQuote.openInterest >= 25 &&
    (liveSpreadPct ?? 100) <= 45
  const strike = canUseLiveQuote ? liveQuote.strike : modeledStrike
  const premium = canUseLiveQuote ? liveQuote.bid : modeledPremium
  const premiumSource = canUseLiveQuote ? "live_chain" : "model_estimate"
  const capitalBase = strategy === "cash_secured_put" ? strike : input.price
  const daysToExpiration = canUseLiveQuote ? liveQuote.daysToExpiration : DISCOVER_TARGET_DAYS_TO_EXPIRATION
  const annualizedYieldPct = capitalBase > 0 ? (premium / capitalBase) * (CALENDAR_DAYS_PER_YEAR / daysToExpiration) * 100 : 0
  if (!Number.isFinite(annualizedYieldPct) || premium <= 0) return null

  const breakeven = strategy === "cash_secured_put" ? strike - premium : input.price - premium
  const roundedStrike = round(strike)
  const roundedPremium = round(premium)
  const roundedYield = round(annualizedYieldPct, 1)
  const roundedBuffer = round(buffer * 100, 1)
  const roundedVolatility = round(volatilityPct, 1)
  const roundedDrawdown = round(maxDrawdownPct, 1)
  const roundedTrend = round(trendScore, 0)

  return {
    symbol: input.entry.symbol,
    name: input.entry.name,
    assetType: input.entry.assetType,
    sector: input.entry.sector,
    strategy,
    strategyLabel: strategy === "cash_secured_put" ? "Sell cash-secured put" : "Sell covered call",
    price: round(input.price),
    strike: roundedStrike,
    expirationDate: canUseLiveQuote ? liveQuote.expirationDate : nextExpirationDate(),
    daysToExpiration,
    premiumEstimate: roundedPremium,
    annualizedYieldPct: roundedYield,
    bufferPct: roundedBuffer,
    breakeven: round(breakeven),
    realizedVolatilityPct: roundedVolatility,
    maxDrawdownPct: roundedDrawdown,
    trendScore: roundedTrend,
    riskScore: score,
    riskBand: riskBand(score),
    confidence: input.history.length >= 200 ? "medium" : "low",
    reasons: buildReasons({
      strategy,
      input,
      annualizedYieldPct: roundedYield,
      bufferPct: roundedBuffer,
      volatilityPct: roundedVolatility,
      maxDrawdownPct: roundedDrawdown,
      trendScore: roundedTrend,
      riskScore: score,
      premiumSource,
    }),
    cautions: buildCautions(strategy, roundedDrawdown, premiumSource),
    data: {
      priceSource: "Yahoo Finance chart",
      premiumSource,
      premiumSourceLabel: canUseLiveQuote
        ? "Cboe delayed option-chain bid"
        : "Black-Scholes estimate from one-year realized volatility",
      optionSymbol: canUseLiveQuote ? liveQuote.optionSymbol : null,
      optionBid: canUseLiveQuote ? round(liveQuote.bid) : null,
      optionAsk: canUseLiveQuote ? round(liveQuote.ask) : null,
      optionVolume: canUseLiveQuote ? liveQuote.volume : null,
      optionOpenInterest: canUseLiveQuote ? liveQuote.openInterest : null,
      optionSpreadPct: canUseLiveQuote && liveSpreadPct !== null ? round(liveSpreadPct, 1) : null,
      optionSourceUrl: canUseLiveQuote ? liveQuote.sourceUrl : null,
      optionQuoteTime: canUseLiveQuote ? liveQuote.quoteTime : null,
      asOf: input.asOf,
    },
  }
}

export function buildStableYieldIdeas(treasuryBillProxyRatePct: number | null): StableYieldIdea[] {
  const billRate = treasuryBillProxyRatePct ?? 4
  const floor = (offset: number) => round(Math.max(0, billRate + offset), 2)
  return [
    {
      id: "t-bill-ladder",
      name: "4- to 26-week Treasury bill ladder",
      category: "U.S. Treasury",
      estimatedAnnualYieldPct: floor(0),
      riskBand: "low",
      liquidity: "Matures on schedule; secondary sale possible but price can move.",
      principalRisk: "Backed by the U.S. Treasury when held to maturity.",
      access: "TreasuryDirect or brokered Treasury bills.",
      taxNotes: "Interest is generally exempt from state and local income tax.",
      whyItBelongs: [
        "Best baseline for comparing every other stable-yield idea.",
        "Short maturities reduce duration risk and make reinvestment simple.",
      ],
      watchouts: [
        "Auction settlement and maturity dates need cash planning.",
        "Selling before maturity can realize a small market gain or loss.",
      ],
      sourceUrl: "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?field_tdr_date_value=2026&type=daily_treasury_bill_rates",
    },
    {
      id: "treasury-money-market",
      name: "Treasury-only money-market fund",
      category: "Cash management",
      estimatedAnnualYieldPct: floor(-0.25),
      riskBand: "low",
      liquidity: "Typically daily liquidity inside a brokerage account.",
      principalRisk: "Not FDIC insured; designed to maintain $1 NAV but not guaranteed.",
      access: "Brokerage money-market fund or cash sweep menu.",
      taxNotes: "Treasury share of income may receive state-tax treatment depending on fund reporting.",
      whyItBelongs: [
        "Useful parking place for cash assigned to put collateral.",
        "Operationally easier than rolling individual bills for small balances.",
      ],
      watchouts: [
        "Expense ratio and sweep defaults can materially change net yield.",
        "Check portfolio composition; prime funds carry different credit exposure.",
      ],
      sourceUrl: "https://home.treasury.gov/treasury-daily-interest-rate-xml-feed",
    },
    {
      id: "insured-deposit",
      name: "FDIC-insured HYSA or brokered CD ladder",
      category: "Bank deposits",
      estimatedAnnualYieldPct: floor(-0.45),
      riskBand: "low",
      liquidity: "HYSA is flexible; CDs lock cash until maturity unless sold or broken.",
      principalRisk: "FDIC insurance applies within coverage limits at insured banks.",
      access: "Bank account, brokered CDs, or cash-management account.",
      taxNotes: "Interest is generally taxable at federal, state, and local levels.",
      whyItBelongs: [
        "Simple emergency-cash bucket with explicit insurance rules.",
        "Good comparison point before accepting market or credit risk.",
      ],
      watchouts: [
        "Promotional APYs, balance caps, and withdrawal rules vary.",
        "Coverage depends on depositor, insured bank, and ownership category.",
      ],
      sourceUrl: "https://www.fdic.gov/resources/deposit-insurance",
    },
    {
      id: "overnight-repo-sweep",
      name: "Overnight Treasury repo or broker cash sweep",
      category: "Overnight cash",
      estimatedAnnualYieldPct: floor(-0.15),
      riskBand: "low",
      liquidity: "Usually overnight or daily liquidity, depending on broker cutoff times.",
      principalRisk: "Depends on repo collateral, sweep bank structure, and broker program terms.",
      access: "Broker cash sweep, Treasury repo fund, or platform cash-management program.",
      taxNotes: "Repo and sweep income is generally taxable; Treasury-backed portions may receive fund-specific reporting.",
      whyItBelongs: [
        "Matches the overnight-cash use case for idle collateral and waiting cash.",
        "Useful benchmark before locking money in CDs or taking ETF duration risk.",
      ],
      watchouts: [
        "Confirm whether the sweep is FDIC-insured bank cash, a money-market fund, or repo collateral.",
        "Program yield can change quickly after policy-rate moves.",
      ],
      sourceUrl: "https://home.treasury.gov/treasury-daily-interest-rate-xml-feed",
    },
    {
      id: "ultrashort-treasury-etf",
      name: "Ultrashort Treasury ETF",
      category: "ETF income",
      estimatedAnnualYieldPct: floor(-0.35),
      riskBand: "moderate",
      liquidity: "Trades intraday; bid/ask spread matters.",
      principalRisk: "Low duration, but ETF price can move and is not insured.",
      access: "Brokerage ETF purchase.",
      taxNotes: "Tax treatment depends on holdings and fund reporting.",
      whyItBelongs: [
        "Liquid cash proxy for investors who prefer ETF rails.",
        "Transparent price history helps compare volatility to bank cash.",
      ],
      watchouts: [
        "Not a bank deposit and not guaranteed to hold a fixed value.",
        "Use limit orders for thinly traded funds.",
      ],
      sourceUrl: "https://www.investor.gov/introduction-investing/investing-basics/glossary/options",
    },
    {
      id: "fully-paid-lending",
      name: "Fully paid securities lending",
      category: "Broker lending",
      estimatedAnnualYieldPct: floor(-1.25),
      riskBand: "moderate",
      liquidity: "Depends on borrow demand and broker program terms.",
      principalRisk: "Collateralized program risk; investor protections differ from deposits.",
      access: "Broker opt-in program for fully paid shares or ETFs.",
      taxNotes: "Payments may not receive the same tax treatment as qualified dividends.",
      whyItBelongs: [
        "Can add incremental yield to long-term holdings without selling options.",
        "Worth tracking when borrow demand is visible and collateral terms are strong.",
      ],
      watchouts: [
        "Yield is variable and can disappear quickly.",
        "Read collateral, recall, voting-right, and SIPC-treatment terms.",
      ],
      sourceUrl: "https://www.investor.gov/introduction-investing/investing-basics/glossary/options",
    },
  ]
}

export function buildStableYieldAsset(input: StableYieldAssetInput): StableYieldAsset | null {
  if (input.history.length < 30 || input.price <= 0) return null
  const volatilityPct = calculateAnnualizedVolatility(input.history) * 100
  const maxDrawdownPct = calculateMaxDrawdownPct(input.history)
  const baseQuality = {
    treasury_cash: 98,
    floating_treasury: 95,
    ultrashort_credit: 86,
  }[input.entry.riskClass]
  const volatilityPenalty = clamp(volatilityPct * 7, 0, 28)
  const drawdownPenalty = clamp(maxDrawdownPct * 6, 0, 30)
  const riskScore = round(clamp(baseQuality - volatilityPenalty - drawdownPenalty, 0, 100), 0)
  const estimatedAnnualYieldPct = round(Math.max(0, input.treasuryBillProxyRatePct + input.entry.yieldOffsetPct), 2)
  const changePct = input.previousClose > 0 ? ((input.price - input.previousClose) / input.previousClose) * 100 : 0
  const roundedVolatility = round(volatilityPct, 2)
  const roundedDrawdown = round(maxDrawdownPct, 2)

  return {
    symbol: input.entry.symbol,
    name: input.entry.name,
    category: input.entry.category,
    issuer: input.entry.issuer,
    price: round(input.price),
    changePct: round(changePct, 2),
    estimatedAnnualYieldPct,
    realizedVolatilityPct: roundedVolatility,
    maxDrawdownPct: roundedDrawdown,
    riskScore,
    riskBand: riskBand(riskScore),
    liquidity: input.entry.liquidity,
    principalRisk: input.entry.principalRisk,
    reasons: [
      `${estimatedAnnualYieldPct}% yield guide is anchored to the current Treasury-bill proxy instead of a stale static APY.`,
      input.entry.issuerObjective,
      `One-year realized volatility is ${roundedVolatility}% and max drawdown is ${roundedDrawdown}%, so this is screened as a cash-like holding rather than an equity-income trade.`,
    ],
    cautions: [
      "Use issuer SEC yield and broker executable price before placing an order.",
      input.entry.principalRisk,
      "ETF distributions and prices move when policy rates, bill supply, spreads, or fund expenses change.",
    ],
    sourceUrl: input.entry.sourceUrl,
    data: {
      priceSource: "Yahoo Finance chart",
      issuerSource: input.entry.sourceUrl,
      asOf: input.asOf,
    },
  }
}
