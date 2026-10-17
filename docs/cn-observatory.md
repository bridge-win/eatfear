# /cn — 中国经济与化债观察台

## 运行

沿用仓库的 Next.js App Router、React、TypeScript、基础主题、SWR 与 Recharts。新增独立 `/cn` 工作台，共享根布局与主题；不修改原有交易页面、账号或基础路由。无需增加运行时依赖、API 密钥或数据库即可请求主要数据源。

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
# http://localhost:3111/cn
```

生产按仓库已有流程 `pnpm build && pnpm start`。需要 Node.js 服务端（不是纯静态导出）。`/api/cn/series` 最长执行30秒，部署平台要允许对应执行时间；不需要单独Python服务。

## 功能

经济全景、专题与标的、指标实验室、化债与传导、历史与情景、数据与方法六个工作区。专题研究支持9只人工核验证券的行情、4只股票同报告期财报比较、手动估值情景、浏览器本地研究笔记和JSON快照；机构来源与研究方法详见 [研究升级说明](cn-research-upgrade.md)。20条定义明确的数据序列：4项财政部地方债原文数据；PMI、非制造业、CPI、PPI、工业、零售、财政收入、M2、贷款、LPR、2/10年国债；沪深300价格指数；世界银行年度GDP与政府最终消费；IMF一般政府债务年度背景。每项附来源、单位、统计期、频率、解释和局限。

支持1/3/5/10年及全部历史、筛选搜索、完整CSV、深浅主题、320px起响应式布局、历史分位、普通Z、稳健M、连续月趋势、同日期限利差、同月CPI-PPI、股票回撤与波动、政策目录、传导证据框架、事件价格复盘、节息及久期试算。

历史数据来源为真实API/官方文章，无随机生成数据或硬编码走势图。第一次请求逐页读历史；中间任一分页失败或重复，拒绝声称历史完整。已有成功缓存时保留原始时间，并披露获取失败。月度/年度频率不插值。长日频历史仅在图形上按月末聚合，下载与计算保留所有观测。

## 数据接口

`GET /api/cn/series?id=pmi`：返回 `id, points[], status, complete, firstDate, lastDate, fetchedAt, publishedAt, sourceUrl, warning`。财政部观测另含逐点原文、发布日期、获取时间。可用id见 `lib/cn/catalog.ts`。

`GET /api/cn/policies`：读取财政部工作动态与统计数据目录，自动发现标题、链接、目录日期。返回 `items, status, checkedAt, liveCount`。历史基线标为 `curated`，不冒充新政策。目录日期未提供则留空。

页面打开时SWR每15分钟检查；服务端与CDN缓存15分钟。年频API缓存一天。刷新按钮仍遵守上游保护缓存，不保证立即绕过缓存。没有页面访问时，不承诺后台秒级采集或推送。宏观最新值取决于源站发布频率，不是交易所实时行情。

### 财政部直接数据

官方网页→确定性采集器→本站JSON API，不宣称财政部提供了这些JSON端点。采集器从债务管理司和原预算司目录向前分页，以2015年为目标起点；只保留实际找到且解析通过的月度文章，不补造早期缺失。

`node --experimental-strip-types scripts/collect-cn-mof.ts` 更新 `public/cn/mof-history.json`，保留原文、发布与采集时间、采集错误。新增+再融资与总发行允许取整误差核对，防止把累计值抓成当月。运行时每15分钟最多检查最新两篇官方文章，合并归档；源不可用时显示归档状态。旧期资料修订需重新运行归档采集器。另提供手动Actions刷新工作流，不擅自按小时向main提交数据。

### 数据源与限制

- 财政部：https://zwgls.mof.gov.cn/tjsj/ ，https://yss.mof.gov.cn/zhuantilanmu/dfzgl/sjtj/
- 东方财富：https://data.eastmoney.com/cjsj/ ，沿用项目已有report/field命名；第三方转引，不伪装直连统计局。
- 世界银行WDI：https://datahelpdesk.worldbank.org/knowledgebase/articles/898581-api-basic-call-structures
- IMF：https://www.imf.org/external/datamapper/api/ ，兼容v2/v1，过滤当年及未来年份。历史仍可能含估算，不进入当期温度。
- Yahoo：https://finance.yahoo.com/quote/000300.SS/ ，日终或延迟价格指数，不含股息。不声称官方授权或稳定性保证。

不同地区服务器访问源站的可用性可能不同。公开网页接口可能改变、限流或中断；商用、公众展示及再分发需逐项核验授权，不能把可请求等同于获准再分发。

### 证券与财报研究接口

`GET /api/cn/securities` 返回固定9只股票/ETF身份和腾讯日终或可能延迟报价，保留上游时间。PE TTM口径未核实保持null，ETF不套用个股PB。研究页每5分钟检查；近期标签采用3个自然日，不代替交易日历。

`GET /api/cn/fundamentals?id=sh601668` 仅接受4只样本股票白名单。东方财富转引三表匹配共同报告期，对比上一年同一期间。展示累计利润/现金流与期末资产负债、公告日期和原文入口。负数/零同比基数不输出百分比。银行指标单列适用口径。公开接口可能不可用，缺失不会填0。

## 指标方法

不输出投资买入总分。需求、价格、信用温度为各自预定义指标历史分位等权，显示有效覆盖；有效项不足半数不评分。财政温度只表示财政收入增速位置，市场温度只表示长端利率位置；不同组不能简单相加。陈旧、未确认完整、估算数据不用于当前温度。

- 当前值不加入基准；月频此前60期，日频756期，至少24个样本。年频此前20期至少10个，只用于历史观察。
- 信贷/地方债发行流量使用此前十年相同日历月，至少5个样本，不做简单环比或样本不足的Z分数。
- 分位采用中位秩。P10/P90是本站观察阈值，不是机构认证风险评级。
- 样本标准差Z；稳健M = 0.6745 × (x−median)/MAD，|M|>3.5标注潜在异常。MAD=0、标准差=0返回null。
- 价格、基数、春节、长期趋势、政策阶梯、统计口径改变均可能影响读数。债务存量不做水平Z风险判断。未接入存在2025年口径断点的M1长序列。
- 同日10Y−2Y转换为bp；CPI−PPI仅匹配同月，不前向填充，不是企业利润率。
- 股指计算252期峰值回撤、至少60个日对数收益的年化实现波动。事件窗口展示价格变化与区间最大回撤，不含分红、费用、基准回报，不声称因果。
- 节息按本金×利差×生效天数/365计算；本金不是节省。久期试算是一阶近似，未计凸性及票息。

方法参考：https://www.itl.nist.gov/div898/handbook/eda/section3/eda35h.htm ，https://www.itl.nist.gov/div898/software/dataplot/refman2/auxillar/mad.htm 。这是公开统计方法的工程化实现，不代表金融研究机构背书。

## 不做的事

不伪造政府资金穿透流水、企业到账、REITs基金排名或ETF申赎。发行不等于实际使用；再融资债不全是隐债置换；IMF债务与官方隐债不可相加。当前不是永久版本化数据库，也不是无前视偏差历史策略回测；不显示收益承诺或胜率。

## 验证

```sh
node --experimental-strip-types --test lib/cn/metrics.test.ts
pnpm exec tsc -p tsconfig.cn.json --noEmit
pnpm build
node --experimental-strip-types scripts/check-cn-sources.ts
# 安装Playwright并启动站点后：
NODE_PATH=/tmp/cn-browser/node_modules node scripts/cn-browser-smoke.cjs
```

`cn-validation.yml`运行单测、专用类型检查、完整构建、在线数据诊断与浏览器测试，上传截图和报告。专用tsc不能被已有next.config的ignoreBuildErrors绕过。数据诊断列明每源实际状态，不把存在适配器当作源站当前可用。合成fixture仅用于测试断言，不进入生产页面。

## 后续边界

需另行取得授权/披露：省市化债实际使用账本、逐笔政府欠款与企业回款、城投合同、信用债估值、基金级REITs与ETF申赎。升级策略研究需保存数据版本与首次可知时间，另做样本外验证、基准和交易成本。
