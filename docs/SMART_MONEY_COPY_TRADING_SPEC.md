# Smart Money & Copy Trading — 二级页面规格 (Spec)

> 路径:`/crypto/smart-money` · 状态:v2 已实现 · 归属:Crypto 模块;一级导航栏(Crypto 右侧)

## 1. 目标

做一个**成熟可用**的聪明钱跟踪 + 跟单学习页面:

1. **看懂聪明钱在做什么**——顶级交易员仓位、主动资金流、大户 vs 散户的分歧。
2. **学习赚钱的人怎么做**——交易所公开跟单榜(带真实收益率、胜率、AUM),可下钻到单个交易员的当前持仓与收益曲线。
3. **跟踪链上聪明钱包**——Hyperliquid 公开钱包持仓/盈亏,用户可自建观察列表。
4. **方法论**——业内公认的聪明钱识别方法与跟单风控清单,而不是无脑抄作业。

## 2. 数据源选型(全部免费、公开、无需 API key)

| 数据 | 来源 | 端点 | 为什么选它 |
| --- | --- | --- | --- |
| 顶级交易员持仓多空比(按仓位) | Binance Futures | `GET /futures/data/topLongShortPositionRatio` | 行业事实标准的"smart money positioning"数据;按名义仓位加权,反映大资金真实方向 |
| 顶级交易员账户多空比(按人数) | Binance Futures | `GET /futures/data/topLongShortAccountRatio` | 与仓位比对照,区分"少数大仓位"与"多数一致看多" |
| 全市场账户多空比(散户情绪) | Binance Futures | `GET /futures/data/globalLongShortAccountRatio` | 作为 crowd 基准,与顶级交易员做分歧对比 |
| 主动买卖量比 | Binance Futures | `GET /futures/data/takerlongshortRatio` | 主动成交方向,验证仓位变化是否有真实资金流配合 |
| 合约多空持仓人数比 | OKX Rubik | `GET /api/v5/rubik/stat/contracts/long-short-account-ratio` | 跨交易所交叉验证,避免单一交易所偏差 |
| 主动买卖资金流(已有) | OKX Rubik | `GET /api/v5/rubik/stat/taker-volume` | 已上线的 `smart-money` 路由,SPOT+SWAP 合并 |
| 跟单交易员排行榜 | OKX Copy Trading | `GET /api/v5/copytrading/public-lead-traders` | 交易所官方公开榜单:收益、胜率、AUM、跟单人数,数据可靠不可刷 |
| 交易员统计/收益曲线 | OKX Copy Trading | `GET /api/v5/copytrading/public-stats`、`public-pnl` | 单交易员下钻:近 90 日日度收益率、胜率、盈亏天数 |
| 交易员当前带单持仓 | OKX Copy Trading | `GET /api/v5/copytrading/public-current-subpositions` | "聪明钱现在拿着什么"——方向、杠杆、开仓价、浮盈 |
| 链上钱包持仓 | Hyperliquid | `POST /info {"type":"clearinghouseState"}` | 链上透明持仓,业内跟踪聪明钱(lookonchain / hypurrscan 等)使用的同一数据源 |
| 链上钱包盈亏历史 | Hyperliquid | `POST /info {"type":"portfolio"}` | 日/周/月/全期 PnL 与成交量,验证钱包是否真的赚钱 |

**Upstream 约束(如实呈现,不造假):**

- Binance `futures/data/*` 仅保留**最近 30 天**历史,单页上限 500 条 → 超过一页时必须分页(见 §4),超过 30 天的 range 前端明确标注"仅覆盖最近 30 天"。
- OKX copy trading 公共端点单页上限 20 条交易员。
- Hyperliquid `/info` 为 POST 接口,不走 Next.js data cache,按请求实时透传。

**Phase 2(需要 key,本期不做):** Coinglass 清算地图、Nansen/Arkham 地址标签、Whale Alert 大额转账。接入方式:同样的 route-handler 代理层,env key 存 Vercel。

## 3. 功能模块

### 3.1 Positioning — 聪明钱 vs 散户分歧
- KPI:顶级交易员多头占比(按仓位)、散户多头占比、**分歧差值(pp)**、主动买卖比。
- 分歧信号:`spread = topPositionLong% − globalLong%`,>+5pp 记为 smart-long/crowd-short(偏多),<−5pp 反之;伴随主动买卖比 >1 / <1 做资金流确认。
- 图 1:三条多头占比曲线(顶级仓位比 / 顶级账户比 / 全市场账户比)+ OKX 账户比交叉验证。
- 图 2:主动买卖量比柱状 + 1.0 基准线。

### 3.2 Flow — 主动资金流(复用已有 SmartMoneyTracker)
- OKX taker-volume SPOT+SWAP 合并,买/卖/净流 + 累计净流,支持全部时间档。

### 3.3 Copy Trading 排行榜(多渠道)
- **多数据源**:OKX(官方公开跟单 API,稳定,支持下钻)+ Binance(带单 portfolio 公开列表,best-effort 未公开端点,归一化为同一结构,失败自动降级为空列表)。源切换器 UI,每个源独立空态,单源不可用不影响另一源。
- 排序:综合 / 收益额 / 收益率 / 胜率 / AUM。
- 行:昵称、收益率 sparkline、PnL、胜率、AUM、带单天数、跟单人数(含满员状态);数据源以 `hasDetail` 标记是否可展开。
- 点击展开(仅支持下钻的源):**随选中时间档自适应**的统计与收益率曲线——`range → OKX lastDays` 映射(1d/5d→7 天,1mo→30 天,其余→90 天),KPI 与曲线标题按解析出的天数动态显示;**当前带单持仓表**(方向、杠杆、开仓均价、标记价、浮盈比例)。

### 3.6 资金真实性验证(反诱导 / 反造假)
用独立、难以伪造的数据交叉验证上方聪明钱信号是否为真实承担风险的资金,而非诱导散户接盘的假仓位:
- **资金费率**(OKX funding-rate-history):持仓的真实成本;极端费率 = 拥挤/挤压/诱多陷阱风险。
- **持仓量**(OKX Rubik open-interest-volume):上升=新资金进场支撑方向,下降=获利平仓/空心行情。
- **跨所一致性**:OKX vs Binance 散户多头占比差值;两个独立交易所口径一致远比单一交易所难伪造。
- **链上锚点**:下方 Hyperliquid 持仓链上结算、完全无法造假,作为终极验真基准。
- 输出:三项 KPI + 四条真实性检查清单(通过/注意/警告/参考,含具体解释),资金费率与持仓量历史迷你图。

### 3.4 链上聪明钱包观察列表(Hyperliquid)
- 用户自行添加 0x 地址(本地持久化,localStorage),不预置第三方地址(避免张冠李戴/过期)。
- 每个钱包:账户权益、可提余额、日/周/月/全期 PnL、当前全部永续持仓(方向、大小、开仓价、清算价、杠杆、浮盈/ROE)。
- 引导文案指向公开榜单(Hyperliquid 官方排行榜 / hypurrscan)自行发现地址。

### 3.5 方法论卡片
- 聪明钱识别:为什么用 top-trader positioning、taker flow、跨所交叉验证;单一指标的失效场景。
- 跟单风控清单:回撤与杠杆检查、AUM 与容量、收益率曲线形态(平滑 vs 单笔暴利)、满员/滑点、永远小仓试跟。

## 4. 技术架构

```
Browser (usePersistentSWR + localStorage 缓存)
   │  /api/crypto/smart-money/*        ← 统一同域代理,免 CORS,免 key
   ▼
Next.js Route Handlers (Vercel, revalidate 缓存 60–300s)
   ├─ positioning     → Binance futures/data ×4 (分页) + OKX rubik long-short (分页)
   ├─ leaders         → OKX public-lead-traders | Binance copy-trade query-list (源可插拔)
   ├─ leader-detail   → OKX public-stats + public-pnl + public-current-subpositions (并行, range→lastDays)
   ├─ verification    → OKX funding-rate-history + OI-volume + OKX/Binance 多空比 (并行)
   └─ wallet          → Hyperliquid /info ×2 (clearinghouseState + portfolio, 并行)
```

设计原则(与现有 crypto 路由一致):

- **薄代理 + 归一化**:route handler 只做参数消毒、分页聚合、字段归一化(上游数字串 → number),不落库。
- **防御式解析**:上游任何失败返回空数组/null,单个 series 失败不拖垮整页;每个 series 独立渲染空态。
- **分页完整性**(CLAUDE.md 规则):Binance 1h×30d = 720 点 > 500/页 → 按时间窗口向前分页直至覆盖 range 或上游无数据;OKX rubik 用 begin/end 窗口分页。不做 `Math.min(300, …)` 式静默截断。
- **缓存**:GET 上游走 Next data cache(`next.revalidate`);positioning/leaders 60s,leader-detail 300s;Hyperliquid POST 不缓存(实时持仓本来就要新鲜)。
- **参数消毒**:ccy 白名单正则、sortType 枚举、uniqueCode `[A-Z0-9]{1,32}`、address `^0x[0-9a-fA-F]{40}$`。
- **前端**:全部 client component + `usePersistentSWR`(秒开缓存 + 后台刷新),recharts 图表,i18n 中英双语,复用 DashboardFrame / SymbolSelector / TimeRangeSelector / InfoTooltip。

### 路由契约

| 路由 | 参数 | 返回 |
| --- | --- | --- |
| `GET /api/crypto/smart-money/positioning` | `ccy`, `range` | `{ series: { topPosition, topAccount, globalAccount, takerRatio, okxAccount }, divergence, clampedDays, note }` |
| `GET /api/crypto/smart-money/leaders` | `source`(okx/binance), `sort`, `page` | `{ source, traders: [...{source,hasDetail}], totalPage }` |
| `GET /api/crypto/smart-money/leader-detail` | `uniqueCode`, `range` | `{ windowDays, stats, pnlSeries, positions }` |
| `GET /api/crypto/smart-money/verification` | `ccy` | `{ funding, openInterest, crossVenue, checks: [{id,status}] }` |
| `GET /api/crypto/smart-money/wallet` | `address` | `{ equity, withdrawable, pnl: {day,week,month,allTime}, positions }` |

## 5. 页面与导航

- `app/crypto/smart-money/page.tsx`(force-static shell)+ `loading.tsx` 骨架。
- 入口:Crypto 看板头部按钮"聪明钱 · 跟单" + 命令面板(⌘K)页面项;顶部导航保持不变(二级页面,/crypto 高亮沿用 `startsWith` 规则)。
- 页内控件:币种选择(BTC/ETH/SOL/XRP/BNB/DOGE)+ 全局时间档(positioning 段自动钳制 30 天并提示)。

## 6. 验收清单

- [x] positioning 在 1mo 档返回 ≈720 点(两页拼接),1d/5d 单页;>30d 档钳制且带 note。
- [x] 各 series 独立空态;上游失败页面不白屏。
- [x] 排行榜五种排序可切换;下钻能看到当前持仓与 90 日收益曲线。
- [x] 钱包观察列表增删持久化;非法地址被拒;持仓字段(清算价、ROE、杠杆)完整。
- [x] 中英文案完整;暗色模式正常;移动端可横滚表格。
- [x] `tsc --noEmit` 与 `eslint` 通过。
