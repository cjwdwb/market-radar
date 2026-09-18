# MR-ASSET-INTELLIGENCE — 2.4 任务与验收归档

## MR-ASSET-INTELLIGENCE — 2.4

状态：实现、测试、独立审计与最终 VERIFY 完成。当前 HEAD 与本地 github/main 为 db35e5c7029f172546a88ccb8bdbd3e83e93cea8；生产仍 2.3 / Sites v20。开始时保留 Provider 文档、PRE24 修复和回归测试等未提交改动，详情见各自归档；不能把它们冒充本次新增。分支 codex/mr-asset-intelligence。

Goal：selected asset 的统一、纯函数、可追溯 Intelligence Context，供 Classic/Radar 共用。Non-goals：新 Signal、阈值/排名/Confidence 算法、网络、计时器、AI、Market State、评分、D1、生产发布和新框架。

CURRENT ARCHITECTURE：Engine 检测/证据/生命周期；useRadar 使用已有 snapshot/10 秒时钟，不请求；Intelligence 负责 confidence/cluster/ranking/summary；Workflow 负责导航引用、按资产 active 过滤、价格提醒数、coverage summary 与周期映射。selectedRadar 由父 useMemo 派生，两个体验不卸载。Context gap：缺少结构化 coverage、运行可用性、保守时效、同资产关联与相对证据引用。

CONTRACT：在 lib/radar/workflow.ts 扩展单一 buildAssetIntelligenceContext；复用 assetRadarContext 的原排序，不建立第二套 Intelligence。输入 events、coverage、symbol、now、enabled/online、isWatched、enabledAlertCount。输出 symbol、coverage（state/reason/relative readiness/原 row）、freshness（state/reason）、activeEvents/primaryEvent/eventCount、latestEvidenceAt、relationship（state/原 event 引用）、relativeSignals（原 signal 引用）、user（isWatched/alertCount，与金融事实分离）。不缓存，输入不变，父组件一次 useMemo 注入双方。

FRESHNESS/COVERAGE：Engine 仅为已有 prepare gate 的输出增加 readiness 状态，不改判断条件或阈值。ready+relative ready=healthy，base ready+relative unavailable=partial；缺 quote/history=waiting；不支持 interval=unsupported；过期/缺最近完整 candle=stale；其余失败/休市/连续样本不足=insufficient。缺 row=waiting，未知分类保守 insufficient。运行暂停/离线 freshness=unavailable；healthy 无事件=current，partial=degraded；已 active 但 expiresAt 到期者不参与 current context。relative coverage 失效时相对事件/含相对 signal 的 cluster 暂不参与 current context；保留原 intelligence/history，不修改原对象。所有状态含可展示原因，不宣称无事件=市场平静。

RELATIONSHIP：仅 current active Event.direction，至少两个 directional events 同向=aligned；有 up 与 down=mixed；仅 neutral=neutral；零或一个 directional=insufficient。提供原事件引用作为依据，不数 cluster 内多个 raw signals 为多个独立 event，不输出趋势或交易结论。relativeSignals 只引用已有 relative signal+benchmark evidence，不重算收益。Primary confidence/severity 沿用 primary，不新增合成评分/分布。

Allowed paths：lib/radar/types.ts、engine.ts（仅覆盖元数据）、workflow.ts；app/market-radar.tsx（必要 wiring）、app/radar.css（现有规则内少量布局）、components/radar/asset-context.tsx、radar-feed.tsx；tests/radar-engine.test.mjs、ui-components.test.mjs、browser/radar.mjs；docs/CURRENT_STATE.md、RADAR.md、ASSET_INTELLIGENCE.md、任务卡与归档。use-radar.ts 只读，若需一致性修复先记录。

ACCEPTANCE/TESTS：纯函数 0/1/多/cluster/resolved/expired、原排序与对象 identity、不同 symbol、用户状态隔离、coverage gate 各分支、健康无事件、relative 失效、pause/offline、expires boundary、relationship 全组合；相关 suite→build/typecheck→全 suite。扩展现有浏览器 harness 五视口，验证快速换 symbol、共享文本、部分/旧/不足状态、导航/周期/Watch/Alert 回归和零导航请求。

REQUEST IMPACT：新增 provider/quote/history/benchmark/API/timer 全为 0；默认 symbol 集合不变。主包本地 pre24 基线 730,363 bytes。简单线性聚合，无证据不进入 Optimizer。

AUDIT：独立 GPT Auditor 只读稳定 diff；检查 stale/cross-symbol/异步 reducer 帧间状态、coverage 与 lifecycle、用户状态污染、memo 依赖、无请求/计时器；Builder fix 后重新 Verify。Provider 不承担架构或最终审计。DEFER：全资产 Context map、confidence 分布、最高 severity 合成、P2 density/大 UI、2.5/2.8/3.0。

最近完成：MR-DEV-DEEPSEEK-PROVIDER。GPT 主导、DeepSeek 受监督 Worker 的最小接入已验证；兼容性和行为限制见 docs/DEVELOPMENT_PROVIDERS.md，审计记录见 tasks/archive/MR-DEV-DEEPSEEK-PROVIDER.md。本轮未推送、未部署。

## 最终实现与验证（2026-09-17）

实际范围符合上述任务卡：workflow 单一 Context builder；Engine 仅追加 readiness 元数据；父组件一次派生并供 Classic/Radar 共用；资产详情默认折叠。当前资产 feed 消费同一有效事件引用，原 raw store/history 保留。类型、字段与降级语义见 docs/ASSET_INTELLIGENCE.md。

修改路径：lib/radar/{types,engine,workflow}.ts、app/market-radar.tsx、app/radar.css、components/radar/{asset-context,radar-feed}.tsx、tests/radar-engine.test.mjs、tests/ui-components.test.mjs、tests/browser/radar.mjs，以及任务卡和三份相关文档。既有 PRE24 及 Provider 改动继续保留，未另行提交或覆盖。

### 实际运行

- 受影响 Engine / Intelligence / UI：44/44 通过。
- `node scripts/typecheck.mjs`：通过。
- `node node_modules/vinext/dist/cli.js build`：通过，仍有既有 >500 KB chunk warning。
- `node --experimental-strip-types --import ./tests/register-types.mjs --test tests/*.test.mjs`：全量 80/80 通过。
- 复用现有 `tests/browser/radar.mjs`，RADAR_INTEGRATION=1，Vite 5175：36 项检查通过、errors=[]；1440×1000、768×1024、390×844、320×740、844×390 均无横向溢出。快速换资产、共享状态/文本、键盘 disclosure、返回、Watch/Alert、周期、reduced-motion、慢请求、空/旧/基准失败等实际执行。导航与详情展开新增 API 请求为 0（测试时暂停 polling clock，避免混入正常轮询）。
- 浏览器第一次在空历史用例失败：fixture 仅清空 crypto history，但用例选 NVDA，其 quote.points 仍有效；修正用例为 BTC 后完整重跑通过，不修改产品迁就测试。
- 报告 outputs/radar/verification.json（22:02:15），截图 outputs/radar/asset-intelligence-{desktop,tablet,mobile,narrow,landscape}.png；人工查看桌面/手机展开详情截图。测试 fixture 不进入生产。
- `git diff --check`：通过，仅本机 CRLF 提示。

### 性能与请求

新增 provider symbols、quote/history/benchmark/API/timer/dependency 均为 0。client 主包从本地 PRE24 的 730,363 bytes 到 734,799 bytes，+4,436 bytes（约 0.61%）。本机 Node 120 个合成事件、每轮 1,000 次 context build、6 轮去掉首轮，余下中位数 5.8015 ms / 1,000 次（约 0.0058 ms / 次）。这是纯函数微测量，不代表移动 FPS、真实市场延迟或完整渲染耗时。无明确瓶颈证据，跳过 Optimizer。

### 独立审计

GPT asset_intelligence_audit 对稳定产品 diff 独立只读审计，分离 PRE24 遗留修改；没有可证实的 BLOCKER/HIGH/MEDIUM finding，无产品修复阶段。独立运行 Engine/Intelligence 38/38 通过；其未自行运行 build、typecheck 或 browser，这些由 Builder 完成。最终 VERIFY 已完成：核对测试 fixture 修正、36 项浏览器报告/五视口、734,799 bytes bundle 与文档契约，无新增 finding；不重复运行已通过 suite、不修改文件。

限制：既有 useRadar passive-effect 更新意味着本层可同步拒绝过期、coverage 失效或暂停事件，但不能在新 snapshot 第一 render 自行判断阈值恢复；检测生命周期仍归 Engine。浏览器采用确定性 fixture，未验证本轮真实 provider 端到端延迟，也未验证生产登录后行为。

DEFERRED：Market State、资产评分、全资产 context map、confidence 分布、持久化历史、AI、2.5/2.8/3.0。当前分支仅本地未提交成果，未 push、未打标签、未修改凭据、未部署。Production: NOT DEPLOYED；线上维持 2.3 / Sites v20。
