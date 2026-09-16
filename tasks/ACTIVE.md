# 当前任务：MR-RADAR-WORKFLOW

状态：PLANNED；2026-09-16。2.1 基线为 `ee16706`，当前分支 `codex/mr-radar-workflow`。本任务只开发、测试和审计，不部署生产、不修改生产 secrets、访问码或 GitHub。

## Coverage Audit — 当前事实

- 扫描输入来自 `OVERVIEW`、浏览器保存的 `watchlist`、当前 `selected` 标的和启用中的 `alerts[].symbol`，在 `symbolKey` 中去重；同一资产不会因多个来源重复扫描。
- `requestKey` 在上述用户相关资产之外加入 `benchmarkSymbols(symbols)`。BTC-USDT、QQQ、000300.SS、^HSI 只作为相对信号的内部 quote/history 依赖，不进入 `radarSnapshot.symbols`、My Radar 或用户 Feed。
- Quote 使用现有 `/api/quotes` 分组；crypto history 使用现有 `/api/history`，没有 signal 或 workflow 独立请求、timer 或 provider。
- Engine 要求 quote/fetch 在 freshness 窗口内、来源与币种一致、股票处于可接受交易时段、至少 22 根连续完整历史；不满足时资产仍在 coverage，但不产生 raw signal。Relative 另需已配置 benchmark、同步 session/source/currency/interval 和至少 12 个对齐窗口。
- 当前 Radar coverage 已显示 `ready / total` 与每个资产的 reason/relativeReason，但没有按 Watchlist 聚合展示“正常/部分覆盖/无覆盖”，也没有将 coverage status 与用户动作关联。

## Workflow Audit — 当前事实

- Radar event 点击 `SignalCard` 的资产按钮调用 `viewAsset`：写入共享 `selected`，切换 Classic，设置 `#price-chart`；hash effect 会滚动到图表。选中资产正确，RadarFeed 仍挂载在 DOM 中，filter/expanded details 状态通常保留。
- 图表默认沿用当前 `range`（初始 15m），不会根据 event 的 `metrics.intervalMinutes` 调整；没有 From Radar context header、事件时间提示或返回 Radar action。
- Classic 已有同一份 `radar.signals` 的 Recent Signals、加入/移出自选和设置价格提醒；Radar 卡片当前只有查看资产、添加/移除自选侧栏动作，事件卡没有直接的 Watch/Alert 入口。
- 返回 Radar 依赖主导航或移动底部导航；没有显式返回按钮，也没有保存/恢复 Radar 页面 scroll position。由于两个体验都在同一组件内，未发现重复 signal store 或额外请求。

## Recommended MVP / scope

1. Coverage summary：在 Radar 侧栏为当前 Watchlist 给出简洁的 `完整覆盖 / 部分覆盖 / 等待数据` 汇总，并保留可展开的具体原因；coverage 计算放在 domain/helper，UI 只展示，不创造金融事实。
2. Radar → Chart context：事件动作进入正确 selected asset 与 chart；根据已有 event signal 的 `metrics.intervalMinutes` 选择支持的 `15m / 1d / 1w / 1m / 3m` 中最接近且安全的范围，未知值回退当前范围。提供轻量 From Radar context（资产、事件、检测时间、confidence）和“返回 Radar”按钮，事件事实来自 intelligence output。
3. Workflow actions：在展开层提供一个主要的“查看图表”动作和轻量“加入/移出自选”“设置价格提醒”动作，复用父组件现有 callbacks；不复制 watchlist、alerts 或 signal store。已有 Watchlist/Alert 状态应直接反映，不重复创建。
4. Return path：保留当前 RadarFeed 的 filter/details 状态；新增返回入口使用 `#radar`，避免重新请求。MVP 不引入全局 store，不承诺精确恢复 scroll position。
5. Information hierarchy：首层保持 asset/event/metric/severity/confidence/time；将 coverage 和 workflow actions 放入侧栏/展开层，避免增加卡片首层密度。移动端详情仍默认折叠，动作触控目标至少 44px。

## Deferred / non-goals

- 不扩大全市场扫描或新增 Signal 类型；Coverage Expansion 只有在后续证据显示真实盲区且可接受请求成本时再规划。
- 不做 Chart marker/annotation engine；本轮只使用现有 chart range 和 context header。
- 不做 D1/session history redesign、Signal Alerts、AI/news/trend prediction、交易、复杂推荐分数、account/backend rewrite。
- 不改变现有 API contracts、行情源、刷新频率、访问控制、production config 或 Sites 发布。

## Architecture / allowed paths

- Domain/workflow types/helper：`lib/radar/types.ts`、必要时新增单一 `lib/radar/workflow.ts` 或 `lib/radar/coverage.ts`。
- Snapshot and shared state：`app/market-radar.tsx`，只做渐进接线，不重写主文件。
- Radar UI：`components/radar/radar-feed.tsx`、必要时新增 `components/radar/coverage.tsx` / `components/radar/workflow.tsx`，以及 `app/radar.css`、`app/mobile.css`。
- Tests：`tests/radar-engine.test.mjs`、新增 workflow/coverage deterministic tests、`tests/browser/radar.mjs`；不创建新的浏览器系统。
- Docs：完成后更新 `docs/RADAR.md` 或必要时新增 `docs/RADAR_WORKFLOW.md`、`docs/CURRENT_STATE.md`。

## Request / performance budget

- Before：默认仍按去重后的 overview + watchlist + selected + enabled alerts 请求，benchmark 合并进同一 quotes/history 路径。
- Target：Workflow 交互 0 个新增行情/API 请求；Watch/Alert 复用已有内存/localStorage handlers。Chart context 只消费 event provenance，不抓取额外 snapshot。
- Acceptance：导航点击不会新增 API 请求；benchmark 不进入用户 coverage list；Watchlist 扩展不会为每个 event 重复请求同一 benchmark。若实现 timeframe 切换，只改变已有 chart history key，且不新增 detector 请求。

## Acceptance and tests

- Coverage：overview/watchlist/selected/alert 去重；benchmark 只作内部依赖；unsupported、missing history、stale quote、benchmark unavailable、partial coverage 有清晰 deterministic reason；Watchlist summary 与实际 coverage 一致。
- Workflow：点击 Radar event 后 selected 正确、Classic/#price-chart 可见、chart range 安全、From Radar context 可见、返回 Radar 不新增 API 请求；Watch/Unwatch/Alert 与 Classic/My Radar 同步。
- Hierarchy/accessibility/mobile：evidence 默认折叠；动作键盘可达、focus 清晰、触控目标 ≥44px；390、320、768、1440 与横屏无溢出；reduced-motion 不新增持续动画。
- Regression：2.1 relative/evidence/confidence/cluster/ranking 语义和 raw store 不变；运行相关 Node tests、browser harness、typecheck/build；Optimizer 仅在测得请求放大、render 或 bundle 回归时进入。

## Handoff

进入 BUILDER 前先实现并验证 Coverage/Workflow contracts。Builder 只改本任务允许路径；完成后提供测试和请求计数。随后按流程决定是否调用 Optimizer，再交独立 Auditor 审计，修复 findings 后复核，最后保持本地不发布。
