# MR-CRYPTO-SOURCE-ALTERNATIVE — 正式替代来源核查

## 最终交接 — 2026-11-06 14:58 UTC，外部入口已上线

用户选择后的轻量入口已通过[PR#18](https://github.com/cjwdwb/market-radar/pull/18)合并；产品cbcec1c，合并源码`8a032159d7c7f76a0e0258747f3bddf23bc2c186`与受测树完全相同。PR CI42237769963/job127959795827和main CI42238130467/job127961038519均build/typecheck及795/795 Node PASS。独立产品审计、追加慢请求复核、发布包审计均VERIFY，无剩余confirmed finding；本地794PASS/1Windows权限SKIP、五视口+慢请求6组PASS，既有lint1error/2warnings未新增。

原站Sites **v42** / version `appgprj_6a9b9dc23584819190a31ae417863e7a~appgver_4411bf6ac9508191a0d38879fd103147`，deployment `appgdep_6aedeaed200c81919c17da18fe7a0db1`于14:58:04UTC原生succeeded/env3。网址 https://market-radar-rex.swt-aether.chatgpt.site 。公开受众、门禁、秘密、DB、AI与独立monitor保持，不发布monitor、不移动标签；v41/0f977a8保留回退点。文档收尾不再次部署。

包2053337bytes，SHA256 `faec76fbfafb0da1daae94917c3e958f3ae0999c962f620eb89e32c1b0958f2b`；46普通文件/13目录均dist内，无调查/私人数据或凭据，45文件逐字节一致，hosting仅等价序列化。server SHA256 `a793142f37de308dedf97e56c458515a4b7edea6daaf3a601393a1b5665ad024`。

实际交付：固定BTC/ETH/SOL的OKX USDT现货官方外部链接，手动新标签页；没有嵌图、换源或Radar/提醒数据接入。官方嵌图渲染FAIL；顶层官方页面文档200但完整图表因验证预算停止而BLOCKED，不能声称外部行情实时已验证。发布成功由Sites原生结果确认，未追加生产取数/长时/真机检查。原ETH429与真实30min/跨bar保持BLOCKED，来源API准入缺口见下表；不把备用链接当原问题已修复。下文保留调查、实施各时点。

2026-11-06；父任务MR-MARKET-LIVE-SOAK。基线cef3767，工作区起始干净；现有生产Sitesv41/source0f977a8，ETH真实上游HTTP429仍开放。用户允许寻找其他数据源；不绕过限流/访问控制，不轮换身份、域名、出口，不购买、不发送外部消息。沿用market-planner，先决策再实现。

## 冻结范围

只评估当前免费非商业网站的公开报价和近期原生15m现货K线（最多96根及有界缓存），优先ETH-USDT、可扩BTC/SOL；不把过去长期归档/AI限制机械当作当前只读显示规则，也不把公开可请求当作展示许可。前三个候选Kraken、Coinbase Exchange、CoinGecko；官方文档/条款优先，技术能力和用途权利分列。不重新探测被429拒绝的OKX链路。

允许路径：本卡、tasks/ACTIVE.md；必要脱敏调查证据仅outputs/crypto-source-alternative，禁止读取其他项目、私人浏览器、Key/账户/自选。独立GPT只读并行调查来源与现有provider接口；协调者单写索引。不使用DS/产品模型，不为未知来源搭演示adapter。

## Builder Gate与验证

来源当前访问、公开免费展示/短缓存权利及身份满足后，冻结唯一来源、pair、单位、时间/完成与缺口契约、请求预算，再批准最小adapter路径。不能混合OKX报价与其他交易所K线，不将USD当USDT、不替换source标签来升权。新来源未满足原State session/confirmed/benchmark时局部降级，不放宽金融规则。

可在已允许的内部评估范围内进行一次有界公开API技术预检：最多一个资产/catalog+quote+OHLC、不超过3请求/1MiB/每请求10s、零重试；遇拒绝立即停止。不启用生产/长期采集，不把单次本地可用当云端长期PASS。条件不满足仅交真实缺项，不扩更多来源/fixture包装进度。

若有代码改动，按实际受影响范围补身份、币种、源不混用、时间/未完成/gap、配额/取消/错误、旧State回归，再build/typecheck相关Node、五视口及独立审计；本轮仅文档则不重复产品全量测试。付费/账号/权限缺口只阻塞对应路径；不能称已解决ETH或已换源。

## 限定扩展：官方嵌图可用性

前三个原始API候选尚未满足公开15m组合；增加TradingView官方hosted Advanced Chart显示路径核查（不是抓其隐藏API或独立图表库）。官方widget页允许免费嵌入网站，FAQ明确无原始data API/不可导出；保留branding。只验证一个OKX:ETHUSDT/15m，本地独立页面和浏览器，最多80HTTP/12MiB/90秒启动截止/最多20秒观察、无自动重试；任何403/429立即停止，不换域名/用户身份。白名单仅官方TradingView widget资产/数据连接，禁止读帧内接口或订阅消息来输入Radar/AI。结果只记渲染、身份标签、网络错误和截图，不保存原始行情流。

用户已明确选择“先增加官方图表作为备用看盘入口”。随后定点诊断官方iframe连接；不重试被拒绝的原数据源，不重置原观察账本。

## 本轮调查与实际预检（2026-11-06）

| 来源 | 实际能力/验证 | 当前公开站准入 |
| --- | --- | --- |
| Kraken | 官方公共API免key、15m、最多720根，末根明确uncommitted。本轮22:31:53–57北京时间（14:31UTC）实际AssetPairs/Ticker/OHLC三请求均200：ETHUSDT、XETH/USDT、online；96根原生15m、0gap、OHLC有效，8553bytes。报价Ticker无逐笔事件时间，不能用fetchedAt冒充quoteAt。仅本机私人技术评估，不保存原始价格。 | Global Terms 2026-10-30 §§8–9仅own benefit并限制向第三方提供Our Content；未找到公开转播/96根短缓存例外。本地可访问不等于公开站可接。先取得对外显示与必要缓存的许可。 |
| Coinbase Exchange | 官方公开ticker/candles免key，900秒、最多300根；缺成交可能缺bar，无明确确认标志。当前ETH-USDT未实际查目录，不能说只有USD。 | Market Data Terms 2026-08-07 §3.2要求事先书面许可才能向组织外展示行情/图表；本轮未请求行情。 |
| CoinGecko普通coin OHLC | 官方近期1–2日自动30min，其他范围4h/4d；付费可hourly/daily，不等于原生交易所15m。Onchain15m属于独立DEX池身份，不能改名作OKX ETH-USDT。Demo月10000次也不能直接承担单会话5秒刷新全天约17280次。 | 免费非商业具体展示许可未完成整体审查；技术周期已不满足，未购买/取行情。不是“付费就能得到原生15m”的结论。 |
| TradingView官方hosted widget | 官方免费对外嵌入、保留branding；支持表列OKX实时crypto，FAQ无data API/导出，不能输入Radar/提醒/AI。 | 官方显示用途ALLOWED，但具体品种/本机渲染未通过，不能发布为可用备用图表。 |

官方依据（仅适用各产品，不互相转移）：
- https://www.kraken.com/legal/global-terms 、https://docs.kraken.com/api-reference/market-data/get-ohlc-data 、https://support.kraken.com/articles/206548367-what-are-the-api-rate-limits-
- https://www.coinbase.com/legal/market_data 、https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-candles 、https://docs.cdp.coinbase.com/exchange/rest-api/rate-limits
- https://www.coingecko.com/en/api_terms 、https://docs.coingecko.com/reference/coins-id-ohlc 、https://www.coingecko.com/en/api/pricing
- https://www.tradingview.com/widget/ 、https://www.tradingview.com/widget-docs/faq/data/ 、https://www.tradingview.com/widget-docs/markets/worldwide/ 、https://www.tradingview.com/policies/

### 嵌图实际结果与限制

第一次Chrome148独立本地预览2HTTP尝试，已计量响应体16282bytes，白名单阻止未审阅frame host。随后仅取官方embed脚本一次200/14835bytes，确认公开frame host为www.tradingview-widget.com；扩展到该明确官方host一次，继承计数，没有来源403/429后绕行。第二次iframe建立但20s内无可见canvas；累计6HTTP尝试（含2次localhost），已计量响应体47399bytes，失败iframe字节UNKNOWN，0WebSocket。响应体读完后才检查大小，故12MiB总网络硬界未验证；不将已计量部分冒充总量。

用户选择备用入口后，14:35:52–14:36:14UTC执行一次定点诊断，同一官方脚本/host，无换源。累计9HTTP尝试（含3次localhost）、已计量响应体63681bytes、0WebSocket；iframe requestfailed明确net::ERR_CONNECTION_CLOSED，未收到HTTP拒绝状态。底层网络/地区原因未确证，渲染FAIL。独立页面/浏览器已退出，不继续重试嵌图。报告widget-preview-diagnostic-report.json；仍有未计量失败响应，不声称总字节硬界。

Kraken三请求间隔至少1.2s，独立硬上限3请求/1MiB/10s每请求/0重试；收到的原始值仅内存校验。保存的是身份/计数/时间范围/验证结果，非公开再分发价格；本轮未调用OKX、Coinbase、CoinGecko行情，未调用模型/开发DS，不使用账户秘密、不改变现有生产。调查和本地脚本/report均在忽略目录outputs/crypto-source-alternative。

### 接入判断

独立技术盘点：当前lib/market-data/market-client/market-history、use-market-history、radar/market-input按-USDT硬编码OKX，其他通常Yahoo/5m；不能只换URL/source字符串。新的独立provider须完整市场/币种/源/周期、缓存/冷却、确认与时间契约；不同源报价/K线不混用，缺基准保持unavailable，原提醒不能静默换市场。Kraken数据虽可取得，但当前Ticker缺quoteAt及公开使用权未解决，因此不进入产品Builder，不做无真实准入的fixture adapter。

以上为调查阶段结论，原始API接入Gate仍未通过；不继续搭未经准入的数据adapter。2.9/3.0及原真实30min/跨bar任务继续OPEN。

## 用户选择后的最小Builder切片

嵌入框架未渲染，先交付官方外部看盘入口，不部署空白iframe或第三方脚本。只在BTC-USDT/ETH-USDT/SOL-USDT当前图表周期栏下显示TradingView链接，固定映射到OKX现货同一交易对；股票/未知资产不猜映射。原生a新标签页打开，noopener/noreferrer；说明独立看图、不提供本站Radar/提醒数据，原图表/错误/过期提示保留。链接不绑定本站range（显示窗口并非外部K线周期），不重置selected、手动周期或用户存储，无自动外连/预加载/嵌图。

允许产品路径：app/market-radar.tsx、app/mono.css；验证复用tests/browser/radar.mjs的隔离fixture入口。协调者维护本卡/ACTIVE和必要发布交接。零provider/API/缓存/刷新/金融算法/访问控制/数据库改动、零依赖。此切片仅实现外部入口，不能以入口测试代替TradingView真实行情刷新或本机iframe渲染成功。

验收：三币地址精确、USD/未知资产不误映射；正常/加载/错误/旧图可达；≥44px、键盘/新标签页、320/390/768/1440及横屏无溢出；回本页selected/range保持；未点击零TradingView请求，模拟点击由测试拦截，不反复请求供应商。运行相关Node、build/typecheck、相关浏览器与独立GPT稳定diff审核；没有性能瓶颈不进Optimizer。按Sites现有站点编辑流程保留公开访问范围；只有通过候选校验才发布，不以新入口关闭原限流/长时任务。

## Builder新测与待交接（2026-11-06）

- 产品仅app/market-radar.tsx（固定映射/原生链接）和app/mono.css（图表区局部样式）；无第三方脚本/iframe、source/API/refresh/State变更。tests/browser/radar.mjs增加限定入口，显式合成授权并拦截所有外部导航。没有新增DS或产品模型调用。
- 官方顶层chart页一次受限独立浏览器检查14:46:53–57UTC：文档HTTP200；65个已观测响应均200，0已观测401/403/429，1WebSocket；触及原请求上限即关闭，chart未渲染。脚本的requests=273是继承9加路由回调尝试（超额项被abort），不能当作273次实际出站；本次最多71个HTTP route.continue，实际完整发送总数未知。累计已读响应体4534809bytes，失败/中断字节未知。外部accounts.google.com被白名单拦截。没有绕开限额追加第二次，不以文档200当图表实时PASS。报告official-chart-report.json。
- 官方嵌图FAIL（ERR_CONNECTION_CLOSED），完整外部TradingView图表实时显示BLOCKED（测试预算提前停止，未完成验证）；产品交付仅外部入口。用户网络下实际图表由TradingView提供，不承诺地区可用性或本机已验证实时刷新。
- Sites build helper尝试失败：本机npm命令不可用，未改构建体系；使用仓库已有Windows入口node node_modules/vinext/dist/cli.js build、node scripts/typecheck.mjs成功。node --experimental-strip-types --import ./tests/register-types.mjs --test tests/market-chart-ui.test.mjs tests/market-data.test.mjs tests/market-history.test.mjs：10/10PASS。
- 五视口Chrome148/本机workerd生产构建/隔离合成行情，新入口5组PASS：1440×1000、768×1024、390×844、320×740、844×390；normal/history-stale/error/empty，三币精确链接、44px、键盘焦点/Enter新页、股票和未批准crypto无入口、返回资产与手动1周保持、零自动外部请求。实际新标签页请求被fixture拦截，不能当真实TradingView显示证据。0pageerror，6条预期合成503 console error。截图及报告outputs/crypto-source-alternative/ui。真机NOT RUN。
- 首轮测试把程序focus误作键盘focus导致断言失败，已通过Tab建立键盘输入再验证；并发现旧偏好读取会把ETH-USD迁移成ETH-USDT，因此测试未知资产改为DOGE-USDT，不修改既有迁移行为，不宣称浏览器实测了独立USD选择。
- eslint当前1error/2warnings；按同filePath比较HEAD与候选，忽略行号偏移后的规则/严重度/首行消息完全相同（既有effect同步setState/removeAsset依赖/img），新测试无诊断。不声称lint-clean。diffcheck通过。
- 全量Node新测795项：794PASS/1Windows文件symlink权限SKIP/0FAIL；不是未执行的npm test包装成功。独立GPT稳定diff审计VERIFY，无新增confirmed finding，原计量P2已修。随后追加慢请求可用性一项，当前浏览器6组PASS，产品未再改变，追加测试定点复核也VERIFY。Optimizer跳过，无本轮性能瓶颈；没有宣称FPS/线上长时改善。开发阶段生产仍v41，后续真实发布见本卡顶部。
