export type SourceConnection = "connected" | "partial" | "reference" | "subscription"
export type SourceCategory = "macro" | "rates" | "securities" | "global" | "terminal"

export type ResearchSource = {
  id: string
  name: string
  category: SourceCategory
  connection: SourceConnection
  authority: string
  url: string
  documentationUrl?: string
  cadence: string
  coverage: string[]
  usage: string
  access: string
  caveat: string
  seriesIds: string[]
  /** Date the directory and access description were reviewed, not a data release or live-health check. */
  verifiedAt: string
}

export const SOURCE_CONNECTION_LABELS: Record<SourceConnection, string> = {
  connected: "已接入部分指标",
  partial: "部分接入 / 转引",
  reference: "原文核验入口",
  subscription: "需商业订阅",
}

export const SOURCE_CATEGORY_LABELS: Record<SourceCategory, string> = {
  macro: "宏观与财政",
  rates: "利率与债券",
  securities: "标的与披露",
  global: "国际可比口径",
  terminal: "数据终端与传输",
}

// This is a research-source directory. Connection describes implemented coverage,
// not availability today, an authorization to redistribute, or a quality rating.
export const RESEARCH_SOURCES: ResearchSource[] = [
  {
    id: "nbs", name: "国家统计局 · 国家数据", category: "macro", connection: "partial",
    authority: "官方统计原始发布", url: "https://data.stats.gov.cn/",
    documentationUrl: "https://www.stats.gov.cn/xxgk/sjfb/fbrcb/",
    cadence: "月度 / 季度 / 年度；按官方发布日历",
    coverage: ["PMI与订单", "消费与工业", "价格、就业、收入", "投资、地产与工业利润"],
    usage: "先看需求、生产与价格是否同向，再查行业分项；用收入和就业验证消费持续性，用库存和利润验证工业订单。",
    access: "公开发布与数据库查询。本站现有6项指标经东方财富转引，尚未直连国家数据，也未自动采集全部行业分项。",
    caveat: "统计期、发布日与数据库更新日不同；官方日历说明进度指标数据库通常在发布后约3个工作日更新。注意累计/当月、名义/实际和修订。",
    seriesIds: ["pmi", "nonpmi", "retail", "industrial", "cpi", "ppi"], verifiedAt: "2026-10-18",
  },
  {
    id: "pboc", name: "中国人民银行 · 金融统计", category: "macro", connection: "partial",
    authority: "央行原始发布", url: "https://www.pbc.gov.cn/diaochatongjisi/116219/116319/index.html",
    cadence: "货币与社融以月度为主；信贷调查、政策报告按发布计划",
    coverage: ["M2", "社融存量与增量", "居民/企业贷款结构", "货币政策执行报告"],
    usage: "将政府债融资和居民、企业融资拆开；对照居民中长期贷款、企业中长期贷款与订单，判断信用是否进入私人部门。",
    access: "公开统计表与报告；本站M2和新增人民币贷款经东方财富转引，社融结构和贷款分项需打开原文核验。",
    caveat: "新增贷款不等于社融；总量增长不代表融资需求改善。口径变更必须记录，不能跨制度直接拼接。",
    seriesIds: ["m2", "loans"], verifiedAt: "2026-10-18",
  },
  {
    id: "mof", name: "财政部 · 地方债与财政收支", category: "macro", connection: "connected",
    authority: "财政部原始发布", url: "https://zwgls.mof.gov.cn/tjsj/",
    documentationUrl: "https://zwgls.mof.gov.cn/",
    cadence: "地方债月报、财政月报；预算与决算按发布计划",
    coverage: ["地方债新增/再融资发行", "债务余额与发行利率", "财政收支", "地方债原文与附件"],
    usage: "沿额度→发行→用途→企业回款验证化债；用地方预算、土地收入和付息负担补充地区偿付能力。",
    access: "本站直接采集4项地方债月度指标，保留逐点原文和发布日期；财政收入仍经东方财富转引。地区附件尚未全面结构化。",
    caveat: "总发行不等于净融资；再融资不全是隐债置换；平均发行利率受期限和地区结构影响，不能直接算真实节息。",
    seriesIds: ["lg_issuance", "lg_refinance", "lg_balance", "lg_rate", "fiscal"], verifiedAt: "2026-10-18",
  },
  {
    id: "safe", name: "国家外汇管理局 · 国际收支", category: "macro", connection: "reference",
    authority: "官方跨境资金统计", url: "https://www.safe.gov.cn/safe/tjsj1/",
    cadence: "结售汇、跨境收付款月度；国际收支与头寸季度为主",
    coverage: ["银行结售汇", "涉外收付款", "国际收支平衡表", "国际投资头寸"],
    usage: "交叉核验出口收入是否转为结汇、资金流动和外币资产负债；再看出口企业汇率敏感性与套保披露。",
    access: "公开表格和口径说明；本路由提供核验入口，尚未自动拉取这些序列。",
    caveat: "结售汇不是资本流动全貌，国际收支货物贸易与海关贸易统计口径不同；外汇储备变化含估值效应。",
    seriesIds: [], verifiedAt: "2026-10-18",
  },
  {
    id: "customs", name: "海关总署 · 货物贸易", category: "macro", connection: "reference",
    authority: "官方货物贸易统计", url: "https://online.customs.gov.cn/",
    documentationUrl: "https://online.customs.gov.cn/static/pages/guides/002029004002/002029004002.html",
    cadence: "月度快讯与正式统计；具体时间查年度发布表",
    coverage: ["商品HS分类", "数量与金额", "贸易伙伴", "贸易方式与省级地区"],
    usage: "先选商品编码，拆出口数量、单价与目的地，再核对公司产品、海外收入地区和利润率，建立出口链候选名单。",
    access: "官方平台提供公众查询和统计服务申请；本站尚未接入HS商品分项，不将全国出口总额代替企业订单。",
    caveat: "HS商品与上市公司行业不是一一对应；单价受产品组合影响。人民币/美元口径、快讯/正式值应分别标明。",
    seriesIds: [], verifiedAt: "2026-10-18",
  },
  {
    id: "chinamoney", name: "中国货币网 · CFETS", category: "rates", connection: "partial",
    authority: "全国银行间同业拆借中心", url: "https://www.chinamoney.org.cn/chinese/bklpr/",
    cadence: "LPR按月公布；资金与市场利率按交易日",
    coverage: ["LPR", "货币市场利率", "银行间市场信息"],
    usage: "区分政策报价、市场资金价格与企业实际贷款成本；研究降息传导时同步看银行资产收益率和负债成本。",
    access: "LPR公开查询；本站只接入东方财富转引的1年期LPR。其他利率、批量服务和展示权限需分别确认。",
    caveat: "LPR是报价参考，不是所有借款人的贷款利率；2019年改革前后不可直接拼接。",
    seriesIds: ["lpr"], verifiedAt: "2026-10-18",
  },
  {
    id: "chinabond", name: "中债 · 曲线与估值", category: "rates", connection: "partial",
    authority: "中债估值中心 / 中央结算公司", url: "https://yield.chinabond.com.cn/cbweb-mn/yield_main?locale=CN",
    documentationUrl: "https://valuation.chinabond.com.cn/cbweb-mn/int/int_yield_syl_doc",
    cadence: "按交易日；不同估值产品以自身时点为准",
    coverage: ["国债与信用曲线", "估值收益率", "久期与凸性", "信用利差"],
    usage: "用同日、同期限曲线比较利差；选债券基金时核对组合久期、信用暴露和费用，并做利率上行压力测试。",
    access: "公开曲线可查询；本站2年/10年国债经东方财富转引，未接入逐券估值或授权完整曲线库。",
    caveat: "估值不是可成交报价。官网明确演绎产品、业绩基准及相关产品用途需书面申请；公开可见不等于获得再分发权。",
    seriesIds: ["cn2y", "cn10y"], verifiedAt: "2026-10-18",
  },
  {
    id: "csi", name: "中证指数 · 指数与样本", category: "securities", connection: "partial",
    authority: "指数编制机构", url: "https://www.csindex.com.cn/",
    cadence: "指数按交易日；样本、权重和编制规则随公告更新",
    coverage: ["指数编制方案", "样本与调整公告", "指数表现", "指数产品信息"],
    usage: "把研究主题映射到指数，核对行业权重、前十大集中度和选样规则，再到交易所找跟踪该指数的ETF。",
    access: "官网为指数核验入口；本站仅有第三方转引沪深300价格，尚未直连样本、权重及估值历史。",
    caveat: "同名主题的指数可能有不同选样与权重。历史研究需当时成分；使用当前成分回看会引入幸存者偏差。批量使用需确认许可。",
    seriesIds: ["equity"], verifiedAt: "2026-10-18",
  },
  {
    id: "cninfo", name: "巨潮资讯 · 公司原始披露", category: "securities", connection: "reference",
    authority: "深交所信息披露官方网站", url: "https://www.cninfo.com.cn/",
    documentationUrl: "https://list.cninfo.com.cn/cninfo/",
    cadence: "定期财报与临时公告；以实际公告日为准",
    coverage: ["年报与季报", "现金流与应收账款", "业务分部", "重大合同与风险事项"],
    usage: "用证券代码检索原始报告，验证收入暴露、应收账龄、经营现金流、减值和净债务；保留报告期、公告日与页码。",
    access: "公开公告可查询；本站链接用于人工尽调，未接入全市场财报数据库。结构化数据服务与公开PDF属于不同产品。",
    caveat: "财报报告期不是可交易信息的首次公开日；更正公告应保留原版本。应收下降可能来自核销、保理或合并范围变化。",
    seriesIds: [], verifiedAt: "2026-10-18",
  },
  {
    id: "exchanges", name: "交易所 · ETF与上市标的", category: "securities", connection: "reference",
    authority: "上海 / 深圳证券交易所", url: "https://etf.sse.com.cn/fundlist/",
    documentationUrl: "https://www.szse.cn/",
    cadence: "交易日行情与基金规模；产品、停复牌和公告按事件更新",
    coverage: ["基金代码与管理人", "跟踪指数", "上市状态", "交易规则与披露"],
    usage: "按标的指数找同类ETF，核对基金代码、上市状态、规模和成交；将基金本身的交易流动性与指数流动性分别判断。",
    access: "提供公开产品名单与公告入口；本站候选目录是人工核验的研究起点，未接入交易所授权实时行情。",
    caveat: "名称、代码、上市市场须成组识别。产品目录不是全市场实时筛选结果；成交价与基金净值可能存在折溢价。",
    seriesIds: [], verifiedAt: "2026-10-18",
  },
  {
    id: "fund-disclosures", name: "基金管理人 · 产品原始文件", category: "securities", connection: "reference",
    authority: "基金管理人披露；交易所发布入口", url: "https://etf.sse.com.cn/disclosure/index.shtml?seaStr=jjgsgg",
    cadence: "净值按基金披露频率；定期报告与临时公告按发布日",
    coverage: ["产品资料概要", "招募说明书与费率", "持仓与跟踪误差", "REITs运营与可供分配金额"],
    usage: "拿到代码后核对投资范围、费率、跟踪误差和真实持仓；REITs另外读租约、出租率、维修资本支出与剩余经营期。",
    access: "从交易所基金公告查管理人原始文件，也可到对应管理人官网核对。本站未自动汇总持仓、净值、PCF或REITs经营表。",
    caveat: "季报持仓有滞后；PCF用于申赎，不应无条件当作完整投资组合。高分派率不必然等于高经营收益。",
    seriesIds: [], verifiedAt: "2026-10-18",
  },
  {
    id: "worldbank", name: "世界银行 · WDI", category: "global", connection: "connected",
    authority: "国际机构统计数据库", url: "https://data.worldbank.org/country/china",
    documentationUrl: "https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api-documentation",
    cadence: "本站所用指标为年度；随数据修订更新",
    coverage: ["实际GDP增长", "政府最终消费占比", "跨国可比指标与元数据"],
    usage: "用于长期增长和经济结构对照，为月度研究提供背景；查看原始定义和来源后再比较不同国家。",
    access: "官方Indicators API已接入2条序列；单项数据的来源与使用条件仍以元数据为准。",
    caveat: "政府最终消费不是政府总支出或投资。年度修订值不能当作当时已知信息，也不适合触发短期交易。",
    seriesIds: ["gdp", "govcons"], verifiedAt: "2026-10-18",
  },
  {
    id: "imf", name: "IMF · WEO / DataMapper", category: "global", connection: "partial",
    authority: "国际机构估算与统计", url: "https://www.imf.org/external/datamapper/profile/CHN",
    documentationUrl: "https://www.imf.org/external/datamapper/api/help",
    cadence: "WEO按发布版本更新；本站展示年度历史",
    coverage: ["一般政府债务/GDP", "国际可比口径", "估算与预测版本"],
    usage: "理解广义政府部门的国际比较；研究时同时记录WEO版本、口径和估算标记，并与财政部官方口径并列说明。",
    access: "DataMapper适配器已实现；历史诊断存在访问失败，实际状态以当前请求结果为准，失败时不填补数值。",
    caveat: "过滤未来年份并不使历史值变为最终实测值；IMF口径不等于官方隐性债务，不能与财政部数字直接相加。",
    seriesIds: ["debt"], verifiedAt: "2026-10-18",
  },
  {
    id: "eastmoney", name: "东方财富 · 公开转引数据", category: "terminal", connection: "connected",
    authority: "第三方聚合与行情服务", url: "https://data.eastmoney.com/cjsj/",
    documentationUrl: "https://data.eastmoney.com/bbsj/",
    cadence: "宏观随发布、财报随公告更新；本站成功缓存通常15分钟",
    coverage: ["宏观历史序列", "部分市场行情", "4只股票三大报表", "同报告期财务同比"],
    usage: "画宏观历史曲线，再用企业收入、利润、经营现金流和资产负债核验传导；重要结论回到官方发布和公司原始财报。",
    access: "本站主要月频与利率的实际传输源；另为4只股票读取利润表、资产负债表、现金流量表，按三表共同报告期和上年同期比较。公开接口不等同于Choice商业API。",
    caveat: "财报仅取最近12个记录，非完整历史或首次发布版本库；利润/现金流为累计，资产负债为期末。银行需专门口径；公告日期由供应商转引。服务稳定与再分发权限未获保证。",
    seriesIds: ["pmi", "nonpmi", "retail", "industrial", "cpi", "ppi", "m2", "loans", "fiscal", "cn10y", "cn2y", "lpr"], verifiedAt: "2026-10-18",
  },
  {
    id: "tencent", name: "腾讯财经 · 证券报价", category: "terminal", connection: "connected",
    authority: "第三方公开行情传输", url: "https://gu.qq.com/",
    cadence: "研究页打开时每5分钟检查；保留上游报价时间，可能延迟",
    coverage: ["9只研究样本证券", "最新价与涨跌幅", "成交信息", "个股PB"],
    usage: "把宏观研究关联到具体股票或ETF的市场价格；先检查报价时点，再结合公司财报、基金净值和自己的估值假设。",
    access: "本站对白名单9只证券批量获取公开报价；证券身份来自官方资料，价格实际来自腾讯。未接入交易所授权实时行情服务。",
    caveat: "报价时间不等于财报发布日期；近期标记使用3个自然日窗口，未覆盖完整交易日历。PE(TTM)因口径未独立核验而留空；PB仅为个股供应商值，ETF估值不套用个股字段。",
    seriesIds: [], verifiedAt: "2026-10-18",
  },
  {
    id: "wind", name: "Wind · 终端与Client API", category: "terminal", connection: "subscription",
    authority: "商业机构数据服务", url: "https://www.wind.com.cn/portal/zh/ClientApi/index.html",
    cadence: "宏观、财报、行情各有频率；以订阅产品为准",
    coverage: ["证券主数据", "宏观与行业", "财报与市场数据", "桌面API"],
    usage: "用统一证券标识和字段批量比较公司、行业与资产；采购前用目标指标样本核对历史覆盖、公告时间和修订字段。",
    access: "需按用途确认终端、API和数据权限及报价。本站没有接入Wind；不得把终端席位自动理解为网站服务端或对外展示许可。",
    caveat: "商业聚合不替代原始披露。服务端部署、历史版本、衍生指标展示和再分发范围应在合同中逐项确认，不预设已有权限。",
    seriesIds: [], verifiedAt: "2026-10-18",
  },
  {
    id: "ceic", name: "CEIC · 中国经济数据库", category: "terminal", connection: "subscription",
    authority: "商业宏观与行业数据库", url: "https://info.ceicdata.com/zh/ceic-china-premium-database-product-page-cn",
    documentationUrl: "https://info.ceicdata.com/api-and-data-feed-solution",
    cadence: "按系列提供日 / 月 / 季 / 年频；更新取决于原始源",
    coverage: ["省市县区域数据", "宏观与行业", "高频与另类数据", "API、数据馈送与元数据"],
    usage: "补充地区财政、产业与高频需求横向比较；先按来源、单位、频率、修订和缺失率筛选，再与官方总量交叉核验。",
    access: "官方提供试用申请、API和数据馈送；本站未订阅或接入。具体数据库、API调用及对外分发许可需单独确认。",
    caveat: "聚合库的优势是覆盖与整理，不代表每条都是官方数据。另类数据可能有样本偏差；时间点更新比较不自动等于完整首次发布版本库。",
    seriesIds: [], verifiedAt: "2026-10-18",
  },
]

export const SOURCE_BY_ID = Object.fromEntries(RESEARCH_SOURCES.map(source => [source.id, source])) as Record<string, ResearchSource>
