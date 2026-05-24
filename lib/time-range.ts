export type TimeRangeId = "1d" | "5d" | "1mo" | "3mo" | "6mo" | "1y" | "5y" | "10y" | "max"

export interface TimeRangeOption {
  id: TimeRangeId
  label: string
  yahooRange: string
  yahooInterval: string
  okxBar: string
  okxLimit: number
  approxPoints: number
  description: string
}

export const timeRangeOptions: TimeRangeOption[] = [
  {
    id: "1d",
    label: "1D",
    yahooRange: "1d",
    yahooInterval: "5m",
    okxBar: "5m",
    okxLimit: 288,
    approxPoints: 288,
    description: "过去 24 小时，5 分钟颗粒度",
  },
  {
    id: "5d",
    label: "5D",
    yahooRange: "5d",
    yahooInterval: "30m",
    okxBar: "30m",
    okxLimit: 240,
    approxPoints: 240,
    description: "过去 5 个交易日，30 分钟颗粒度",
  },
  {
    id: "1mo",
    label: "1M",
    yahooRange: "1mo",
    yahooInterval: "1h",
    okxBar: "1H",
    okxLimit: 300,
    approxPoints: 300,
    description: "过去 1 个月，1 小时颗粒度（默认）",
  },
  {
    id: "3mo",
    label: "3M",
    yahooRange: "3mo",
    yahooInterval: "1d",
    okxBar: "4H",
    okxLimit: 280,
    approxPoints: 280,
    description: "过去 3 个月，4 小时 / 日颗粒度",
  },
  {
    id: "6mo",
    label: "6M",
    yahooRange: "6mo",
    yahooInterval: "1d",
    okxBar: "12H",
    okxLimit: 300,
    approxPoints: 300,
    description: "过去 6 个月，半日颗粒度",
  },
  {
    id: "1y",
    label: "1Y",
    yahooRange: "1y",
    yahooInterval: "1d",
    okxBar: "1D",
    okxLimit: 300,
    approxPoints: 365,
    description: "过去 1 年，日线颗粒度",
  },
  {
    id: "5y",
    label: "5Y",
    yahooRange: "5y",
    yahooInterval: "1wk",
    okxBar: "1W",
    okxLimit: 260,
    approxPoints: 260,
    description: "过去 5 年，周线颗粒度",
  },
  {
    id: "10y",
    label: "10Y",
    yahooRange: "10y",
    yahooInterval: "1mo",
    okxBar: "1M",
    okxLimit: 120,
    approxPoints: 120,
    description: "过去 10 年，月线颗粒度",
  },
  {
    id: "max",
    label: "MAX",
    yahooRange: "max",
    yahooInterval: "1mo",
    okxBar: "1M",
    okxLimit: 300,
    approxPoints: 600,
    description: "全部历史，月线颗粒度",
  },
]

export const DEFAULT_TIME_RANGE: TimeRangeId = "1mo"

export const isTimeRangeId = (value: string): value is TimeRangeId => {
  return timeRangeOptions.some((option) => option.id === value)
}

export const getTimeRange = (id: TimeRangeId | string | null | undefined): TimeRangeOption => {
  return timeRangeOptions.find((option) => option.id === id) ?? timeRangeOptions[2]
}

/**
 * Convert a time range id into a Date offset relative to "now" (used by FRED / Blockchain.com).
 */
export const getRangeStartDate = (id: TimeRangeId, now: Date = new Date()): Date => {
  const date = new Date(now.getTime())
  switch (id) {
    case "1d":
      date.setDate(date.getDate() - 1)
      break
    case "5d":
      date.setDate(date.getDate() - 5)
      break
    case "1mo":
      date.setMonth(date.getMonth() - 1)
      break
    case "3mo":
      date.setMonth(date.getMonth() - 3)
      break
    case "6mo":
      date.setMonth(date.getMonth() - 6)
      break
    case "1y":
      date.setFullYear(date.getFullYear() - 1)
      break
    case "5y":
      date.setFullYear(date.getFullYear() - 5)
      break
    case "10y":
      date.setFullYear(date.getFullYear() - 10)
      break
    case "max":
      date.setFullYear(date.getFullYear() - 30)
      break
  }
  return date
}

/** Number of days the range covers from now, useful for CoinGecko / Blockchain.com queries. */
export const getRangeDays = (id: TimeRangeId): number => {
  switch (id) {
    case "1d":
      return 1
    case "5d":
      return 5
    case "1mo":
      return 30
    case "3mo":
      return 90
    case "6mo":
      return 180
    case "1y":
      return 365
    case "5y":
      return 365 * 5
    case "10y":
      return 365 * 10
    case "max":
      return 365 * 30
  }
}

/** Blockchain.com Charts API timespan string. */
export const getBlockchainTimespan = (id: TimeRangeId): string => {
  switch (id) {
    case "1d":
    case "5d":
      return "30days"
    case "1mo":
      return "30days"
    case "3mo":
      return "90days"
    case "6mo":
      return "180days"
    case "1y":
      return "1year"
    case "5y":
      return "5years"
    case "10y":
      return "10years"
    case "max":
      return "all"
  }
}
