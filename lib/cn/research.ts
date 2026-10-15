export const POLICY_SOURCE = "https://www.mof.gov.cn/zhengwuxinxi/caizhengxinwen/202411/t20241109_3947230.htm"
export const HISTORY = [
  { year: "1999", title: "银行不良资产处置", tool: "资产管理公司承接不良资产", body: "研究对象首先是银行、AMC与债权处置。资产转移不等于损失消失；后来的房价变化还受到住房制度、收入与信贷等因素影响。", watch: "银行资本、处置回收率、信贷恢复", url: "https://www.bis.org/publ/work115.htm" },
  { year: "2008—2014", title: "地方融资与债务形成", tool: "投资扩张与地方融资安排", body: "这是理解债务如何形成的背景期，不是一次完整化债。公共投资、土地相关收入与平台融资之间的关系，需要放回当时的财政与金融结构。", watch: "债务责任、偿债来源、期限错配", url: "https://yss.mof.gov.cn/zhuantilanmu/dfzgl/zcjd/201803/t20180326_2851249.htm" },
  { year: "2015—2018", title: "存量债务置换", tool: "规范举债、降低成本、拉长期限", body: "认定的存量政府债务置换为地方政府债券。发债偿还旧债与新增财政支出不同；不能把同期棚改、货币政策与房地产行情全归因于置换。", watch: "融资成本、利率、财政支出与同期政策", url: "https://yss.mof.gov.cn/zhuantilanmu/dfzgl/zcjd/201803/t20180326_2851249.htm" },
  { year: "2018—2023", title: "增量约束与持续治理", tool: "风险监测、财政重整、分阶段安排", body: "重点转向预算约束、责任边界与地方差异。全国政策无法直接说明某一平台债务安全，也不能把平台退出等同于企业所有债务消失。", watch: "地方财力、债务属性、经营性现金流", url: "https://yss.mof.gov.cn/zhuantilanmu/dfzgl/zcjd/201803/t20180326_2851249.htm" },
  { year: "2024—2028", title: "大规模置换与结构修复", tool: "6万亿限额 + 4万亿配套安排", body: "2024—2026年增加6万亿元限额；2024—2028年每年安排8000亿元。另有2万亿元远期棚改债务按原合同偿还，不是追加2万亿元现金。", watch: "额度→发行→实际使用→回款→需求接力", url: POLICY_SOURCE },
]
export const TRANSMISSION = [
  { title: "政策与额度", kind: "规则", text: "谁获得融资资格？新增、再融资还是置换？", evidence: "正式文件、预算调整、额度用途", missing: "意向不等于正式授权", group: "fiscal" },
  { title: "发行与使用", kind: "财政账", text: "发了多少？实际用于偿还什么债务？", evidence: "发行文件、结果、资金使用报告", missing: "再融资债不能全部当作隐债置换", group: "fiscal" },
  { title: "企业与银行", kind: "经营账", text: "欠款是否到账？信用损失和成本是否改善？", evidence: "实际回款、应收账龄、现金流、拨备", missing: "回款不是新增收入；当前未接企业级穿透账本", group: "money" },
  { title: "订单与需求", kind: "实体账", text: "企业愿不愿投资？居民愿不愿消费？", evidence: "PMI、工业、零售与融资结构", missing: "政府融资增加不等于私人需求接力", group: "activity" },
  { title: "定价与回报", kind: "市场账", text: "风险是否下降？价格有没有提前买贵？", evidence: "国债曲线、权益价格、未来现金流与估值", missing: "好政策不保证高回报，更不保证低风险翻倍", group: "markets" },
]
export const ASSETS = [
  { name: "利率债", driver: "利率与期限", thesis: "融资成本下降可能支持债券价格，但新增供给与增长修复也可能推动利率回升。", confirm: "看同日收益率与久期，而不是只看信用等级。", risk: "长久期净值回撤；不能把票息当总回报。", id: "cn10y" },
  { name: "银行", driver: "信用成本 × 息差", thesis: "偿付改善可能减少信用损失，资产收益率下降却可能挤压息差。", confirm: "等财报验证不良、拨备、贷款收益与现金回收。", risk: "政策利好被提前计价，经营改善不及预期。", id: "loans" },
  { name: "回款改善企业", driver: "现金流兑现", thesis: "清欠可能降低企业融资压力；需要证明款项真正到账。", confirm: "现金流、应收账龄、净债务一起改善。", risk: "核销、保理、资产转让导致应收下降，不能当经营复苏。", id: "industrial" },
  { name: "基础设施 REITs", driver: "运营现金 × 买入价", thesis: "盘活存量资产提供投资入口，但不自动创造新增经营收入。", confirm: "核对租金、收费、维护开支、剩余经营期。", risk: "高分派可能包含本金返还；没有接入基金级行情不输出排名。", id: "cn10y" },
]
export type Policy = { title: string; url: string; date: string | null; type: "live" | "curated"; source: string }
export const BASELINE: Policy[] = [
  { title: "增加地方政府债务限额置换存量隐性债务：6＋4＋2的不同性质", date: "2024-11-09", url: POLICY_SOURCE, type: "curated", source: "财政部 · 历史基线" },
  { title: "地方政府债务管理政策答问：置换、预算与风险处置", date: "2018-03-26", url: HISTORY[1].url, type: "curated", source: "财政部 · 历史基线" },
]
export const MOF_LISTS = ["https://zwgls.mof.gov.cn/gzdt/", "https://zwgls.mof.gov.cn/tjsj/"]
const plain = (s: string) => s.replace(/<[^>]*>/g, "").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim()
export function parsePolicyList(html: string, base: string): Policy[] {
  const result: Policy[] = []
  const blocks = html.match(/<li\b[^>]*>[\s\S]*?<\/li>/gi) ?? []
  for (const block of blocks) {
    const a = /<a\b([^>]*)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/i.exec(block)
    if (!a) continue
    const titleAttr = /\btitle=["']([^"']+)["']/i.exec(a[1] + a[3])
    const title = plain(titleAttr?.[1] ?? a[4])
    if (!/债务|债券|财政|化债|预算/.test(title) || title.length < 8) continue
    try {
      const url = new URL(a[2], base)
      if (url.protocol !== "https:" || !["zwgls.mof.gov.cn", "www.mof.gov.cn", "yss.mof.gov.cn"].includes(url.hostname) || !/\.html?$/.test(url.pathname)) continue
      const date = /\b(20\d{2}-\d{2}-\d{2})\b/.exec(plain(block))?.[1] ?? null
      result.push({ title, url: url.href, date, type: "live", source: "财政部债务管理司 · 自动发现" })
    } catch { continue }
  }
  return [...new Map(result.map(p => [p.url, p])).values()]
}
