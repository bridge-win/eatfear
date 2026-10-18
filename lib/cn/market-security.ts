import type { MarketRow } from "./market-types.ts"
import type { CnSecurity } from "./security-catalog.ts"
export function securityFromMarketRow(row: MarketRow): CnSecurity {
  return { id: row.id, code: row.code, exchange: row.exchange, name: row.name, fullName: row.name, kind: "stock", financial: row.financial, themeIds: [], exposure: row.industry ?? "行业待核对", thesis: "由真实日终估值与统一报告期财务形成筛选结果，继续核对原始披露。", checklist: ["核对主营收入、业务分部和原始财报", "检查减值、非经常损益与经营现金流"], risks: row.flags, officialUrl: row.officialUrl, verifiedAt: row.quoteDate ?? "" }
}
