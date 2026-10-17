"use client"
import { useState } from "react"
import { ExternalLink, Search } from "lucide-react"
import { RESEARCH_SOURCES, SOURCE_CONNECTION_LABELS, SOURCE_CATEGORY_LABELS } from "@/lib/cn/source-registry"
import s from "./research-workspace.module.css"

export default function SourceGuide() {
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("all")
  const sources = RESEARCH_SOURCES.filter(source => (category === "all" || source.category === category) && `${source.name} ${source.coverage.join(" ")} ${source.usage}`.toLowerCase().includes(search.toLowerCase()))
  return <section className={s.workspace}>
    <div className={s.heading}><div><span className={s.eyebrow}>RESEARCH DATA DESK</span><h2>像研究员一样，先选对数据</h2><p>机构研究需要来源、口径、发布时点和修订记录。以下目录区分已连接数据与仍需查阅或订阅的数据。</p></div></div>
    <div className={s.guideSteps}>{[
      { title: "1. 先看原始发布", text: "统计局、央行、财政部回答发生了什么。记录统计期与公告日期，拆分同比/环比、存量/流量、当月/累计，确认是否季调。" },
      { title: "2. 再查传导和标的", text: "交易所、巨潮与基金管理人回答谁受影响。核对公司分部、现金流、应收、基金持仓和指数权重，找直接证据。" },
      { title: "3. 最后评估价格", text: "指数估值、财报与行情回答市场付了多少钱。比较同口径历史与同业，做盈利及估值情景，并记录会推翻判断的事实。" },
    ].map(step => <article className={s.card} key={step.title}><h3>{step.title}</h3><p>{step.text}</p></article>)}</div>
    <div className={s.filters}><label className={s.search}><Search size={15} /><input aria-label="搜索研究数据源" value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索机构、数据或研究用途" /></label><select aria-label="数据源分类" value={category} onChange={event => setCategory(event.target.value)}><option value="all">全部数据源</option>{Object.entries(SOURCE_CATEGORY_LABELS).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></div>
    <div className={s.guideGrid}>{sources.map(source => <article key={source.id} className={s.card}><div className={s.sourceMeta}><span className={s.badge}>{SOURCE_CATEGORY_LABELS[source.category]}</span><span className={`${s.badge} ${source.connection === "connected" ? s.support : ""}`}>{SOURCE_CONNECTION_LABELS[source.connection]}</span></div><h3>{source.name}</h3><p>{source.authority}</p><p>{source.coverage.join(" · ")}</p><p className={s.explanation}>{source.usage}</p><details className={s.sourceDetails}><summary>查看接入方式、频率与口径</summary><dl><dt>获取方式</dt><dd>{source.access}</dd><dt>发布频率</dt><dd>{source.cadence}</dd><dt>使用边界</dt><dd>{source.caveat}</dd><dt>目录核查</dt><dd>{source.verifiedAt}（并非观测发布日期）</dd></dl></details><div className={s.links}><a href={source.url} target="_blank" rel="noopener noreferrer">打开原始来源<ExternalLink size={12} /></a>{source.documentationUrl && <a href={source.documentationUrl} target="_blank" rel="noopener noreferrer">方法与接口说明<ExternalLink size={12} /></a>}</div></article>)}</div>
    {!sources.length && <p className={s.empty}>没有匹配的数据源，请调整搜索。</p>}
    <div className={s.thesis} style={{ marginTop: 20 }}><h3>使用“机构级数据”时，还需要验证什么</h3><p>商业终端的价值包括覆盖、标准化、修订追踪与服务保障。本页未购买或接通 Wind、CEIC 等商业订阅；公开接口可访问，不等同于取得商业再分发许可。历史分位和异常阈值属于本站研究工具，没有机构背书或收益预测保证。</p><p>本页保留当前版本历史。导出快照可以记录今天看到了什么，但建立无前视偏差回测还需要持续保存首次发布时间、每次修订和交易成本。</p></div>
  </section>
}
