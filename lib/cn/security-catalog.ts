export type CnSecurityKind = "equity-etf" | "bond-etf" | "stock"
export type CnSecurity = {
  id: string
  code: string
  exchange: "SSE" | "SZSE" | "BSE"
  name: string
  fullName: string
  kind: CnSecurityKind
  themeIds: string[]
  exposure: string
  thesis: string
  checklist: string[]
  risks: string[]
  officialUrl: string
  verifiedAt: string
  financial?: boolean
}

// Manually verified identities, not an exhaustive universe or a scored buy list.
// The thesis/checklist are research hypotheses; they do not assert current fundamentals.
export const CN_SECURITIES: readonly CnSecurity[] = [
  {
    id: "sh510300", code: "510300", exchange: "SSE", name: "沪深300ETF华泰柏瑞",
    fullName: "华泰柏瑞沪深300交易型开放式指数证券投资基金", kind: "equity-etf", themeIds: ["broad"],
    exposure: "沪深300指数；观察大盘股盈利与估值的共同变化。",
    thesis: "当需求、信用和企业盈利同时改善时，用宽基检查复苏是否扩散到上市公司。",
    checklist: ["查看最新指数成分与行业集中度", "对比指数盈利增速和历史估值，区分盈利修复与估值抬升", "核对基金净值、折溢价、跟踪误差、成交额和费率"],
    risks: ["宏观改善可能已经反映在价格中", "指数的金融及其他大权重行业会影响整体表现"],
    officialUrl: "https://www.sse.com.cn/disclosure/fund/etflist/detail.shtml?etfClass=03&fundid=510300&type=008", verifiedAt: "2026-10-18",
  },
  {
    id: "sh512800", code: "512800", exchange: "SSE", name: "银行ETF华宝",
    fullName: "华宝中证银行交易型开放式指数证券投资基金", kind: "equity-etf", themeIds: ["debt", "rates"],
    exposure: "中证银行指数；观察银行资产质量、息差与分红的组合变化。",
    thesis: "化债可能缓解部分信用风险；是否改善股东回报，还取决于净息差、拨备和资本要求。",
    checklist: ["从基金定期报告核对银行权重与地区暴露", "逐家观察净息差、不良生成、拨备覆盖率及核心一级资本充足率", "估值比较使用成分股PB与可持续ROE，另查ETF折溢价"],
    risks: ["贷款降息可能压缩净息差", "债务置换不等于银行损失消失或利润立即增长"],
    officialUrl: "https://www.fsfund.com/webimages/upload2012/2025/03/19/13ebc2ad-db16-48a4-bef6-b81a03a45833/华宝中证银行交易型开放式指数证券投资基金基金产品资料概要（更新）.pdf", verifiedAt: "2026-10-18",
  },
  {
    id: "sz159928", code: "159928", exchange: "SZSE", name: "消费ETF汇添富",
    fullName: "中证主要消费交易型开放式指数证券投资基金", kind: "equity-etf", themeIds: ["consumption"],
    exposure: "中证主要消费指数；其行业权重与社会消费品零售总额口径不同。",
    thesis: "先确认收入、销量与渠道库存改善，再判断主要消费企业盈利能否跟随。",
    checklist: ["查最新前十大持仓，确认实际行业集中度", "对照品类销量、终端价格、库存与企业毛利率", "比较盈利预期、估值和ETF折溢价，避免用社零直接预测基金收益"],
    risks: ["少数消费子行业可能权重集中", "渠道去库存、价格竞争可能抵消销量增长"],
    officialUrl: "https://www.99fund.com/main/products/pofund/159928/fundgg.shtml", verifiedAt: "2026-10-18",
  },
  {
    id: "sh511010", code: "511010", exchange: "SSE", name: "国债ETF国泰",
    fullName: "上证5年期国债交易型开放式指数证券投资基金", kind: "bond-etf", themeIds: ["rates"],
    exposure: "上证5年期国债指数；用来研究中期利率债价格对收益率的敏感度。",
    thesis: "若收益率下降，债券价格通常受益；需要将票息、久期、费用和价格变化一起计算。",
    checklist: ["从最新基金报告取得实际组合久期，不将名称中的5年当作久期", "分别试算收益率上行与下行的价格变化", "比较净值折溢价、买卖价差、成交额及分红调整"],
    risks: ["收益率上行可能导致净值下跌", "国债信用质量不消除市场价格与流动性风险"],
    officialUrl: "https://www.gtfund.com/product/productlist/zhishu/511010/index.html", verifiedAt: "2026-10-18",
  },
  {
    id: "sh511260", code: "511260", exchange: "SSE", name: "十年国债ETF国泰",
    fullName: "上证10年期国债交易型开放式指数证券投资基金", kind: "bond-etf", themeIds: ["rates"],
    exposure: "上证10年期国债指数；与中期国债ETF比较期限风险。",
    thesis: "研究长端利率方向与收益率曲线形态，并检查较长期限所增加的波动是否可承受。",
    checklist: ["读取最新组合久期、到期收益率和持仓", "结合国债供给、资金利率和通胀预期解释长端利率", "以实际久期测算利率上行损失，再核对折溢价与流动性"],
    risks: ["长期限通常意味着更大的利率敏感度", "降政策利率不保证长端国债收益率同步下降"],
    officialUrl: "https://www.gtfund.com/product/productlist/zhishu/511260/index.html", verifiedAt: "2026-10-18",
  },
  {
    id: "sh601668", code: "601668", exchange: "SSE", name: "中国建筑",
    fullName: "中国建筑股份有限公司", kind: "stock", themeIds: ["debt", "industry"],
    exposure: "建筑与基础设施业务；研究清欠、项目回款和新增订单的传导。",
    thesis: "清欠落地只有体现在现金回款、减值和资产周转中，才构成经营改善证据。",
    checklist: ["读取定期报告的经营现金流、应收账款和合同资产附注", "比较同季现金回款、账龄和减值，排除季节性影响", "跟踪新签合同质量、地产敞口和实际分红覆盖"],
    risks: ["新签合同不等于收入或现金流", "地产风险、项目延期与资产减值可能抵消化债收益"],
    officialUrl: "https://www.cscec.com/zgjz_new/tzzgxnew/gpjg/", verifiedAt: "2026-10-18",
  },
  {
    id: "sh600036", code: "600036", exchange: "SSE", name: "招商银行",
    fullName: "招商银行股份有限公司", kind: "stock", themeIds: ["debt", "consumption", "rates"],
    exposure: "银行零售与公司金融；研究信贷质量、居民资产负债表和息差。",
    thesis: "观察零售贷款风险与财富管理收入能否改善，同时检验息差下降的抵消程度。",
    checklist: ["从业绩报告提取净息差、逾期与不良生成、信用成本", "分开检查住房、信用卡和小微贷款质量", "把PB与可持续ROE、资本充足率及分红能力结合比较"],
    risks: ["宏观信用总量改善不代表个别银行贷款质量改善", "利率、财富管理业务和资产质量可能出现相反方向变化"],
    officialUrl: "https://cmbchina.com/cmbir/", verifiedAt: "2026-10-18",
  },
  {
    id: "sh600031", code: "600031", exchange: "SSE", name: "三一重工",
    fullName: "三一重工股份有限公司", kind: "stock", themeIds: ["industry", "debt"],
    exposure: "工程机械；研究设备更新、施工需求与出口订单。",
    thesis: "将行业销量与企业收入、毛利率和现金流交叉验证，区分国内复苏和海外扩张。",
    checklist: ["将国内与海外收入、销量和利润贡献拆开比较", "观察应收周转、经营现金流、存货和经销商回款", "使用中周期利润评估估值，避免把景气峰值低PE当作便宜"],
    risks: ["行业需求与设备更新周期可能错位", "海外竞争、汇率和贸易政策影响利润"],
    officialUrl: "https://www.sany.com.cn/", verifiedAt: "2026-10-18",
  },
  {
    id: "sh600900", code: "600900", exchange: "SSE", name: "长江电力",
    fullName: "中国长江电力股份有限公司", kind: "stock", themeIds: ["rates", "broad"],
    exposure: "水力发电；研究现金流、分红和利率变化。",
    thesis: "将现金分红和国债收益率比较前，先验证来水、电价、资本开支与债务对现金流的影响。",
    checklist: ["核对季度发电量、来水变化与实际结算电价", "从年报计算扣除资本开支后的现金流及债务成本", "核对分红方案、除权日和股息率口径，做估值敏感性分析"],
    risks: ["来水、电价和资本开支使现金流波动", "高分红股票的价格仍可能大幅波动"],
    officialUrl: "https://www.ctg.com.cn/cypc/index/index.html", verifiedAt: "2026-10-18",
  },
]

export type CnSecurityQuote = {
  price: number
  previousClose: number
  changePercent: number
  quotedAt: string
  currency: "CNY"
  peTtm: number | null
  pb: number | null
  volumeShares: number | null
  turnoverCny: number | null
  freshness: "recent" | "stale"
}

export type CnSecuritiesResponse = {
  status: "ok" | "partial" | "unavailable"
  fetchedAt: string
  source: string
  sourceUrl: string
  warning: string
  items: { security: CnSecurity; quote: CnSecurityQuote | null; error?: string }[]
}
