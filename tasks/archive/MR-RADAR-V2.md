# 当前任务

状态：VERIFIED COMPLETE；任务 MR-RADAR-V2；协调者单写。

## Goal
保留 Classic，增加共享数据的 Radar 事件流、默认体验设置、筛选、My Radar、资产回跳及近期信号。

## Baseline
7fb0eebc40e3bec14d3d7efce219cdc4b77ccf62；开始时工作区干净。GitHub 当前公开；本轮本地开发，不部署网站。

## Non-goals
不重写 Classic，不改数据提供方、刷新频率、价格提醒阈值、认证、数据库、依赖或动画框架。无预测/交易/新闻/云端信号/推送功能。

## Allowed paths
app/market-radar.tsx（共享状态最小接入）；app/radar.css、app/layout.tsx（样式入口）；components/radar/*；lib/radar/*；components/motion-experience.tsx（导航职责边界）；tests/radar*.test.mjs；docs 和任务卡。必要浏览器测试脚本置于 tests/browser/，测试输出进入 outputs/。

## Architecture / API / Storage impact
- 沿用单一 MarketRadar 状态所有者；Classic 与 Radar 共享 watchlist/quotes/alerts/settings。
- 保留锚点导航：#overview、#radar、#watchlist、#price-alerts、#price-chart；设置仍用现有弹窗。根路径在 hydration 后读取 marketMode，服务端稳定渲染 Classic。
- marketMode 加到现有 preferences-v1；仅影响默认打开体验，导航不覆盖默认值。Signal Store 保存当前页面会话有限历史。
- 复用现有股票 Quote.points（5 分钟）和 crypto overview history（15 分钟）；为历史保留 source/currency/fetchedAt，禁止 detector 请求网络。不新增 API 或轮询。
- Engine 为纯函数：snapshot → detectors → normalized signals → lifecycle/dedupe store → UI；显式 now。
- 支持 price_move（按实际 5m/15m/1h 数据）、recent-range breakout/breakdown、volatility_spike；crypto 在完整 confirmed bars 和基线足够时支持 volume_spike。
- DEFERRED：crypto 5m（无当前数据）；股票 volume_spike（跨市场时段基线尚不可靠）；relative strength/weakness（缺少统一基准与同步窗口）。不把近 20 根范围写成 24h high。
- 新鲜 quote 与同源同币种历史才检测；股票仅常规交易中且数据不延迟，排除跨时段、缺口和未完成 bar。缺失/错误/陈旧仅降低覆盖，不制造信号。
- fingerprint + episode/cooldown + 恢复滞回；支持 active/resolved/expired；保留来源、报价时间、bar 时间、检测时间、计算基线。

## Acceptance
Classic/图表/自选/提醒回归正常；Radar 和默认体验保存可用；相同自选双向同步；至少一种真实数据完整链路；空/慢/局部失败/过期/暂停文案准确；点击信号聚焦真实资产；390/768/1440/320/横屏无溢出；键盘、严重程度文字及实时 reduced-motion 正常。

## Testing
deterministic engine tests：触发/不触发、陈旧、缺口、不同市场、缺量/基准、去重、冷却、恢复/过期与有限历史。浏览器拦截测试仅验证，不进生产。最终构建+现有全套 Node tests；独立 auditor 审计固定 diff，Builder 修复后复核。已知 lint 有既有问题，区分新增与存量。

## Dependencies / Parallel tasks
A mode foundation → B domain → C feed → D asset integration → E reliable extra signals。Builder 串行写；独立只读 Auditor 在稳定 diff 后审计，不开第二套 framework。

## Risks
历史点粒度与 confirmed 语义不同；交易时段缺口；延迟股票覆盖不足；切换模式不能复制请求或播放开场；旧 signal 不能在数据失败时仍被误称实时。对这些条件增加明确测试。

## Result / Verification
- A–E 完成：默认体验、共享状态、纯引擎、生命周期、筛选/My Radar、来源详情、资产回跳、近期信号和四类可靠信号。
- 历史有效基线最终至少22根；股票按最新连续时段切片。额外修改README用于交付入口，未扩大产品功能。
- 43/43全套Node测试通过，其中14项Radar；最终Vinext构建成功；新增代码/测试ESLint通过；五种视口与17类浏览器检查通过，无pageerror。
- 8次体验导航新增0 API请求，未运行无证据的Optimizer阶段。
- 独立Auditor报告两项P2（跨日未恢复重复、方向反转吞掉信号），Builder修复，Auditor独立2项定向复核通过；无未解决BLOCKER/HIGH。
- 实连取得OKX 96根历史、A股/港股休市报价；BTC/NVDA报价失败，缺乏有效输入时生成0信号。未验证实时异常、生产环境或真机Safari。
- tsc仍报现有Cloudflare类型声明缺失；大chunk提示保留。完整说明见docs/RADAR.md。
- 本地分支codex/mr-radar-v2；未发布网站、未更改远程可见性。
