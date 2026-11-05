# 行情可靠性与 Radar 状态复用

## 2026-11-05 行情刷新与 K 线候选契约

任务 [MR-MARKET-DATA-RELIABILITY](../tasks/archive/MR-MARKET-DATA-RELIABILITY.md)，开发基线 main `4352b73`、原生产 Sites v36/source `84511bf`。以下契约已随v37/source2d2d08b发布；平台成功与真实刷新验证分开，见[发布记录](../tasks/archive/MR-PUBLISH-MARKET-RELIABILITY.md)。后面的 2026-09-15 报告保留为历史证据，不代表本轮执行。

- 历史读取绝对截止 26 秒，包含排队和响应体；直接上游最多 4 次、单跳最多 8 秒。配置代理最多 6 秒且不与直接源叠加。仅传输/瞬时 5xx 可走现有受控回退；403、429、业务拒绝、超时、环境拒绝、无效数据和取消均不换地址试探。OKX 所有历史/报价路径共享当前服务实例的限流冷却，最少 60 秒并尊重更长 Retry-After；没有跨实例协调保证。
- 已配置代理的 200 必须验证身份、币种、周期、OHLC、时间、原获取时间和元数据；半配置及代理错误明确失败，不无声绕回直接源。旧代理内部重试/取消状态 UNKNOWN；不能凭本地源码推断远端已升级。monitor 兼容改动也只在本地候选，未单独部署。
- Quote API 整批 16 秒，股票最多 4 个并发，Yahoo 单资产最多 2 次传输尝试，OKX 一次共享 ticker 路径最多 2 次。所有资产返回独立结果。前台正常 5 秒加密/15 秒股票、允许后台 60 秒的策略保留。新请求加入同键在途；单个消费者取消不会误杀其他消费者；全部退出才取消底层，旧 finally 不删除新条目。
- 页面主图和分析基线共享完全相同的 OKX 15m×96 请求（界面 range=15m/1d），其他周期不合并。手动检查覆盖报价、主图、当前分析基线，绕过页面短缓存但遵守冷却；来源缓存仍保留其真实获取时间。暂停自动监控后，初次加载/显式选资产/手动读取可用，不因恢复网络或可见性悄悄恢复自动请求。
- 失败保留同资产、同范围的旧图和时间并显示原因；分析输入标记失败，不用旧历史生成新的当前结论。时钟自然越界仍按原有效性规则降级；新的成功数据才清理失败。未改变 Signal/State 阈值、提醒条件、行情源或币种。
- `confirmed` 只能来自来源；未知不会转成已收盘。Yahoo 5m/15m/60m 另用 `windowEnded`，日线无已核实 session 终点时保持未知。OKX `vol` 为现货基础币数量；ticker 成交额为报价币。`metadata.lastCompleteAt` 是完整 bar 的结束时间，不是开盘或请求时间。
- OKX range=15m/1d→原生15m×96，1w→1H×168，1m→4H×180，3m→1Dutc×90；1m 是一月。Yahoo 实际周期为 15m/5m/60m/1d/1d。查看范围不等于完整覆盖，缺口不填零、不插值；走势断开，MA7/25 在缺口后重新等待完整连续窗口。
- 显示时区可选设备、UTC、Asia/Shanghai；SSR 固定 UTC 并提示等待设备时区。Intl 按每个事实时间计算夏令时偏移。只格式化显示，不改事实时间、来源分桶、图表位置、请求、提醒或归档 UTC。报价、当前事件、图表与提示框共用显示策略。
- 错误与诊断仅记录固定字段：错误代码、阶段、追踪号、耗时、可观察尝试数、上游状态和冷却；不打印凭据、代理 URL、响应正文或异常栈。无法观测的代理内部请求数明确 UNKNOWN。

官方核对：2026-11-05 [OKX v5 Candlesticks](https://www.okx.com/docs-v5/en/#order-book-trading-market-data-get-candlesticks)、[Intl.DateTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat)、[AbortSignal.any](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/any_static)。文档与实际运行验证分别记录；具体本轮证据见最终专项报告。

## 历史报告（2026-09-15）

2026-09-15；任务 MR-RADAR-RELIABILITY；基线 `3bf421a`。本轮仅保留本地成果，未推送或部署。

## 原因与改动

- Windows 沙箱内的官方请求均被 EACCES 拒绝；这类环境权限错误现在明确报告，不能通过应用内重试解除。允许联网的本地预览运行于 `http://localhost:5174`，仍使用既有门禁。
- 沙箱外实测出现 ECONNRESET 和读取响应体中断；一次成功的 OKX 批量报价耗时 7,638 ms，超过原先单域名 6 秒预算。OKX 单域名预算调整为最多 8 秒，继续使用既有 openapi.okx.com / www.okx.com 顺序。
- Yahoo 只对传输失败提供最多一次恢复机会，两次共用原有 12 秒预算。HTTP 错误、无效 JSON、权限拒绝不在辅助模块重试。
- 相同 OKX 在途请求合并；429 和 OKX 50011 保留等待状态，同一路径不再通过另一个官方域名立即重试。等待至少 60 秒并遵守更长的 Retry-After；并发限流保留最长等待时间。不同历史接口仍保留既有回退。
- OKX candles 总预算 16 秒，history-candles 总预算 8 秒。加上现有监控代理 6 秒，总网络等待预算约 30 秒，低于浏览器 35 秒。超时包括读取响应体；事件循环或运行平台暂停不构成严格墙钟保证。
- Radar 继续正常扫描和判断恢复、过期与新证据。没有实际变化时复用 store / signals / gates，避免 reducer 提交无效状态；已恢复的 gate 不再重复复制。
- 从构建生成的真实 Wrangler 配置产生官方 runtime 声明，补齐 cloudflare:workers、Fetcher、D1Database。声明位于被忽略的 `.wrangler/types/worker-configuration.d.ts`；未添加伪造全局类型或新依赖。UI 仅补充已有响应契约类型，DB 保留可选绑定与缺失时报错的行为。

未改变行情提供方、币种、报价时间含义、轮询频率、提醒阈值或失效数据规则。在途与限流记录只作用于当前服务实例，不提供跨 Worker 实例协调。

## 测量

固定 70 根完整 BTC 测试 K 线，重复相同扫描 1,000 次，6 轮、首轮预热。测试数据只存在于验证脚本，不进入产品。

| 指标 | 修改前 | 修改后 |
| --- | ---: | ---: |
| 每轮无效 store 替换 | 1,000 | 0 |
| 每轮无效 signals 数组替换 | 1,000 | 0 |
| 后 5 轮扫描耗时中位数 | 18.21 ms | 13.86 ms |

这是本机微基准，不能推导页面 FPS 或设备功耗的提升比例。原始数据位于本地 `outputs/radar/benchmark-before.json` / `benchmark-after.json`。

真实验证通过了两条链路：直接调用行情模块，以及经过本地 Worker 门禁的站点 API。BTC、NVDA、600519.SS、0700.HK 全部返回报价，BTC 历史返回 96 根。站点 API 报价耗时 7,329 ms，历史 7,029 ms，均 HTTP 200。股票处于休市，保留原始收盘时间并退出实时扫描；本次 0 条信号，不代表已验证真实异常触发。网络波动下的一次成功不构成长期可用性承诺。

## 验证与复现

- 最终构建成功；55 项 Node tests 通过，包括 11 项传输/去重/限流/预算专项测试及 Radar identity / expiration 回归。
- `node scripts/typecheck.mjs` 通过：每次从 `dist/server/wrangler.json` 生成声明，然后运行全项目 `tsc --noEmit`。先运行构建；`npm test` 已串联此步骤，现有 GitHub CI 会调用它。
- 本机缺少 Bash，因此使用 `node node_modules/vinext/dist/cli.js build` 执行实际构建，再单独执行类型检查和 Node tests；没有声称本机完整 Bash 包装脚本或远程 CI 已执行。
- 修改后的行情、Radar、DB、脚本及专项测试 ESLint 通过；全仓 lint 未重跑，旧 UI hooks 检查问题不在本轮类型补充范围。
- Edge 自动检查 1440×1000、768×1024、390×844、320×740、844×390；无横向溢出或 pageerror。17 项检查覆盖导航、共享自选、提醒、慢/空/失败/过期状态、存储不可用、键盘、reduced-motion 与开场。8 次体验导航新增 API 请求 0。
- 浏览器入口 `tests/browser/radar.mjs`；使用可用 Playwright / Edge、忽略的本地 `.dev.vars` 与 `RADAR_PREVIEW_URL`。截图和报告在本地 `outputs/radar/`。本轮不修改布局；手机截图已人工查看。
- 独立 Auditor 提出历史链路预算可能达到 38 秒的问题，已将回退限制为 8 秒，并用确定性时序测试验证总预算。独立审计随后因额度限制中断；最终修复由主代理检查，未宣称独立复核完整通过。主代理另修复并测试了并发限流覆盖更长等待时间的边界。

仍有限制：构建保留已有 >500 KB chunk 提示；未验证真机 Safari、生产站点访问、云端 cron 或持续线上网络质量。本轮代码不能解除 chatgpt.site 的 Cloudflare 访问封禁。
