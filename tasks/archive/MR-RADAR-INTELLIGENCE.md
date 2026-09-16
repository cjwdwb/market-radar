# MR-RADAR-INTELLIGENCE

状态：完成；2026-09-16。产品基线 `106799fb6900e55e6629c5416dc0c2decbe553e3`，最终实现 `0710a7e`，分支 `codex/mr-radar-intelligence`。

## 完成摘要

- 实际 scope：完成 Phase A Relative Strength/Weakness、Phase B Evidence + Confidence、Phase C Clustering + ranking + 60 分钟 deterministic summary。Phase D D1 持久历史与完整日/周 Phase E summary 按规划延期。
- Architecture：保持 `Snapshot once → Signal Engine → raw signals → Intelligence Layer → Radar UI`。`lib/radar/intelligence.ts` 纯计算 confidence、cluster、context、ranking 与 summary；raw signals 保留且每条最多归属一个展示事件。
- Relative：显式白名单映射 altcoin→BTC-USDT、当前科技/成长美股→QQQ、A 股→000300.SS、港股→^HSI；未知标的不推断基准。使用同步完整 15 分钟窗口，计算 asset return − benchmark return，并以近期相对差中位数和绝对 floor 判定异常。任一侧陈旧、错时段、错来源/币种/周期或样本不足均拒绝。
- Confidence / Evidence：severity 与 confidence 独立。置信度使用资产与基准中较差的新鲜度、样本量及阈值超出程度/独立支持信号，输出 high/medium/low 与可读理由。Engine 为所有信号提供 reason、baseline、threshold、来源和完整时间 provenance。
- Clustering：首版组合动能扩张、突破确认、卖压增强、相对强/弱事件；仅合并同资产、15 分钟内、active、方向和类型兼容的信号。展开卡片保留每个次级信号的完整证据和 provenance。
- Performance：未新增 detector 请求或 timer；benchmark 合并进现有分组轮询，默认最多增加 3 个实际额外代码。1,000 次 intelligence 计算的预热中位数为 4.4163 ms。主客户端 chunk 相对基线增加 11,936 bytes（1.68%）；没有满足 Optimizer gate，故按流程跳过。既有 >500 KB chunk 警告仍在。
- Verify：全量 Node tests 64/64、类型检查、Vinext 生产构建、diff check 通过。修复前完成 1440/768/390/320/844×390 五档浏览器验收；修复后补充 benchmark-only Classic 隔离及 cluster provenance 浏览器断言，但当前会话缺少 Playwright 模块，未自动复跑该脚本。
- Audit：首轮发现 3 HIGH、1 MEDIUM；Builder 修复显式 benchmark 边界、双边 freshness、内部 benchmark 错误隔离及组合证据完整性。最终独立 Auditor Verify：BLOCKER 0 / HIGH 0 / MEDIUM 0。
- Limits：未实现 D1 历史，因为现有 monitor 只有轻量报价且 schema/auth/history budget 需要独立任务；未发布、未推送，未更改访问控制、刷新策略、行情源或数据库。

## Goal / product outcome

把 Radar 从原始异常卡片流升级为确定性 intelligence layer：提高相对信号质量，以结构化证据解释触发原因，用独立 Confidence 表达数据可靠性，把同资产同一异常过程聚合为少量可读事件，并用稳定、可解释的顺序优先展示用户自选和高质量事件。

核心原则：QUALITY > QUANTITY；只使用当前真实行情可证明的事实；不猜新闻或原因；Classic、提醒和原始 Signal 生命周期保持现状。

## 本轮 scope

### Phase A — Relative Strength / Weakness

- 新增 raw signal：`relative_strength`、`relative_weakness`。
- Benchmark 固定映射由 domain 层提供，benchmark 只作为快照依赖，不自动进入自选或 Feed：

| 资产 | Benchmark | 依据 / 限制 |
| --- | --- | --- |
| ETH、SOL、XRP、DOGE、LINK、ADA、AVAX 等 USDT altcoin | `BTC-USDT` | 同为 OKX、USDT、15m；BTC 自身本轮无可靠 broad crypto proxy，不生成 relative signal |
| 当前目录中的美股个股（含 NVDA/AAPL/MSFT/TSLA/GOOGL/AMZN/META/COIN） | `QQQ` | 当前真实 Yahoo 数据能力；科技/成长目录的一致、可解释 proxy；QQQ/SPY/指数自身不生成 relative signal |
| A 股个股 | `000300.SS` | 当前目录已有沪深 300；指数自身不生成 relative signal |
| 港股个股 | `^HSI` | Yahoo 可表达的恒生指数；先加入内部目录身份并实连验证，失败时仅该相对能力降级 |

- 资产和 benchmark 必须市场一致、source/currency 一致、session 同为 open、quote/fetch/history 均通过现有 freshness 规则、interval 相同。
- 仅使用时间戳完全对齐的连续完整 K 线；最新完成 K 线结束时间差不得超过一个 interval，报价时间差最多一个 interval，且不得跨 gap 拼接。
- 计算同一窗口的 `asset return - benchmark return`。窗口：股票 3×5m = 15m；crypto 1×15m = 15m。近期基线使用至少 12 个历史对齐窗口的 relative delta；当前绝对 delta 超过 `max(3 × 历史绝对 relative delta 中位数, market floor)` 才触发，floor 初值股票 0.35%、crypto 0.60%，由测试固定并在 evidence 展示。
- 方向按 relative delta 正负；不把绝对上涨等同 relative strength。指纹必须含 benchmark、window、source 和 interval。
- benchmark 缺失、过期、休市、时间错位、source/currency/interval 不匹配、样本不足时不生成；coverage 为对应资产返回具体降级原因，但不阻止其原有 signal。

### Phase B — Evidence + Confidence

- `RadarSignal` 增加 Engine 产出的结构化 `evidence`，UI 不按 signal type 自行猜解释。Evidence 至少覆盖：计算指标、baseline、threshold、数据来源、quote/evidence 时间；relative 额外保留 benchmark symbol、return、timestamp。
- 保留现有 `metrics` 供算法和回归；evidence 是人可读 domain output，值仍使用原始数值与显式单位，不存 HTML。
- Intelligence layer 为每个展示事件计算 `high | medium | low` Confidence，与 severity 分离。
- 可解释三项规则，每项 0/1：数据 freshness 位于允许窗口前半；历史样本达到最低值的 1.5 倍；触发强度达到阈值 1.5 倍或有独立相关 active signal 支持。3=high，2=medium，0–1=low。缺失必要证据的 raw signal 拒绝进入新 intelligence presentation，但 raw store 不删除；既有历史 signal 允许以 low +“证据版本较旧”局部降级。
- Confidence output 携带理由列表，不显示伪精确百分比。

### Phase C — Clustering + ranking + UI

- 新增 `lib/radar/intelligence.ts`，输入 raw signals、watchlist、now；纯函数输出 presentation events、raw signal 引用、confidence、context、ranking reason。不得请求数据。
- 聚合窗口在 domain 层定义为 15 分钟，UI 不写死。仅聚合同资产、active、evidenceAt 相差不超过窗口、方向兼容且类型相关的信号。
- 首版组合：`momentum_expansion`（同方向 price_move + volatility/volume，可含同向 range break）；`breakout_confirmation`（breakout + price_move up 或 volume）；`selling_pressure`（breakdown + price_move down，由 volume/volatility 支持）；`relative_strength_event` / `relative_weakness_event`（relative + 同向 price move 或 range break）。
- 一个 raw signal 最多归属一个 cluster；cluster 不删除或改写 raw store。无法聚合的信号成为 singleton presentation event。resolved/expired 不参与 active cluster，但在“包含历史”中仍能作为 singleton 展示。
- 排序为可解释的字典序：active > history；watchlist > non-watchlist；cluster > singleton；severity；confidence；detectedAt。不得使用隐藏加权黑盒。
- Feed 默认渲染 intelligence events。卡片首层仅显示资产、主事件、主指标、时间、severity、confidence；`details/summary` 展开 Why triggered、可证明 Context、来源与时间链、生命周期及 cluster 中 raw signals。语义化标题、键盘可展开、标签不只靠颜色。
- 增加顶部确定性近 60 分钟摘要，仅统计当前 presentation events：关注标的数量、high/critical 数量和前三个需要关注事件；无事件时保持安静状态。该摘要不持久化、不调用 AI。
- 复用现有 motion vocabulary，只允许一次 arrival、轻微 cluster 组合和 disclosure；reduced-motion 禁用。手机默认折叠详情，触控目标至少 44px。

## Snapshot / request contract

- `app/market-radar.tsx` 根据当前扫描资产推导去重 benchmark symbols，合并进现有分组 `/api/quotes` 请求；不为 detector 创建独立请求或定时器。benchmark 不加入 watchlist、overview、搜索结果或 Classic UI。
- 股票 benchmark 历史沿用 quote.points；crypto benchmark 与资产历史沿用现有 history fetch/cache，但只为实际需要的 benchmark 补充一次共享 history。`Snapshot once → raw detectors → intelligence → UI`。
- 保持 `/api/quotes`、`/api/history` 响应结构和现有 28-symbol 上限；推导后的请求必须分组且不会超过现有批次边界。新增 `^HSI` 只扩展 Asset identity/display，不修改 API。
- Provenance：relative raw signal 必须保存 asset/benchmark quoteAt、fetchedAt、history evidenceAt、source、currency、interval。
- benchmark/API 失败仅关闭对应 relative signal；原始 price/range/volatility/volume、Classic 和其他资产继续工作。

## Deferred / explicit non-goals

- Phase D D1 persistent Radar history deferred。现有 monitor 每分钟只取轻量 quote，未取得 signal engine 所需历史；schema 只有 settings/alerts/runtime。实现会要求 migration、历史获取预算、monitor 协议与 owner/visitor 读取边界。此次不修改 `monitor/schema.sql`、`monitor/worker.mjs`、`db/schema.ts` 或 monitor API。
- 无限历史、跨设备 Radar history、通知推送 deferred。当前继续使用最多 120 条 session raw signals；Recent Activity 只从本会话 raw signals 派生。
- 更完整的 Phase E 日/周 summary deferred；本轮仅做当前 60 分钟 deterministic summary。
- 不做 AI prediction/explanation、新闻原因、交易、组合管理、全市场扫描、WebSocket、账户重写、回测、策略市场、新依赖、新动画框架、新 Agent Framework 或 Skill。
- 不重写 `market-radar.tsx`，不更换行情源/币种/轮询频率/提醒阈值，不放宽 stale/session/gap gating，不发布或推送。

## Allowed paths / ownership

- Domain：`lib/market.ts`、`lib/radar/types.ts`、`lib/radar/engine.ts`、新增 `lib/radar/intelligence.ts`（仅在证据表明确需要时才拆第二个 intelligence 文件）。
- Snapshot integration：`app/market-radar.tsx`、`components/radar/use-radar.ts`。
- UI：`components/radar/radar-feed.tsx`、`app/radar.css`，必要时 `app/mobile.css` / `app/motion.css` 仅修改 Radar 相关规则。
- Tests：`tests/radar-engine.test.mjs`、新增 `tests/radar-intelligence.test.mjs`、必要的 `tests/quote-performance.test.mjs` 与 `tests/browser/radar.mjs`。
- Docs/task：`docs/RADAR.md`、`docs/ARCHITECTURE.md`、`docs/API_CONTRACTS.md`（仅记录无 breaking API 与 benchmark snapshot）、`docs/CURRENT_STATE.md`、`tasks/ACTIVE.md`，完成后归档。
- 禁止触碰访问控制、monitor/D1 schema、依赖/锁文件、站点配置与部署文件。

## Acceptance / deterministic tests

- Relative：明显强、明显弱、同涨同跌无异常；benchmark 缺失/陈旧、asset 陈旧、session 不同、timestamp 错位、source/currency/interval 不同、历史不足均明确拒绝；四市场映射和 BTC 自身 deferred 明确。
- Evidence：所有新生成 raw signal 有结构化、有限、确定性 evidence；relative provenance 完整；UI 不拼 detector 原因。
- Confidence：fresh+sufficient+strong 不为 low；边界 freshness/最低样本/弱超阈值确定性降级；支持信号只提升解释项，不改变 severity。
- Cluster：相关信号聚合；无关类型、不同资产、方向冲突、窗口外、resolved 不错误聚合；每个 raw signal 最多一次；raw store 数量与内容不变。
- Ranking：watchlist+active 优先，然后 cluster、severity、confidence、recency；相同输入结果稳定并有 ranking reason。
- Noise：高频相同 snapshot 仍复用 raw store；至少 1,000 次重复 intelligence 输入输出可结构复用或证明计算成本可忽略；120 条 raw history 下 presentation 不爆炸。
- UI：Classic 行为不变；Radar 筛选、My Radar、包含历史、资产跳转、展开 evidence、summary 正常；benchmark 不显示为用户自选。benchmark/部分数据/D1 不可用均局部降级。
- Accessibility/mobile：390、320、768、1440 和手机横屏无横向溢出；summary 语义清晰；details 键盘可用；severity/confidence 有文字；触控目标 ≥44px；reduced-motion 正常。
- Run：Radar engine/intelligence、quote-performance 和相关 UI/browser tests；全 Node tests；typecheck；Vinext build；受影响文件 lint。仅在 bundle 或 benchmark 请求出现实测回归时进入 Optimizer。

## Role handoff

1. BUILDER：先固定 types/evidence/benchmark contract 和 engine tests，再实现 intelligence 纯函数/tests；随后接 snapshot 和 UI；最后浏览器验证。
2. OPTIMIZER gate：记录新增 benchmark 请求数、1000 次 intelligence 计算、client bundle 对比。只有请求重复、明显重算或 bundle 增长有证据时进入；否则写明跳过。
3. AUDITOR：基于本任务 baseline 与最终稳定 diff，只读检查 relative 时间同步、raw/presentation 解耦、confidence 可解释性、cluster 唯一归属、partial failure、UI accessibility 与测试缺口。
4. BUILDER FIX → AUDITOR VERIFY：修复所有 BLOCKER/HIGH；复核后才能归档。最终保持本地，不发布、不推送。
