# 行情可靠性与 Radar 状态复用

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
