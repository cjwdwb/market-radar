# MR-SOAK-ISOLATED-VERIFY — 本地真实墙钟模拟补证

2026-11-06 Builder 独立工作树 `worktrees/soak-verification` / `codex/mr-soak-verification`，基线 `d640424e9c5c07f8fcf7f83345ebb5ae7e97a9d1`。只读上级任务卡 `worktrees/reliability30/tasks/MR-MARKET-LIVE-SOAK.md` 最新隔离范围；生产 v40 的 26.146 秒观察因 ETH 第二次 history429 停止，真实 30min/两次收盘仍 BLOCKED。本任务禁止真实市场请求，不改产品、不发布、不写共享 ACTIVE。

## 范围与实现

- 仅 `tests/browser/market-reliability.mjs` 新增可选 `RADAR_RELIABILITY_ONLY=soak` 分支，`tests/browser/radar.mjs` 两处入口/合成认证接线；复用现有 harness 和 Miniflare，无新平台或依赖。未调用旧 fixtureScenario 或任何 page.clock/visibility 覆盖。
- Miniflare 复用 `reliability30/dist`；server SHA256 `115add5f72b9f50593bf16f3d78080c52ee5641877411a5c11b34ef91e18cb9c`，与已测 v40 构建一致。绑定为明确合成值，不读 `.dev.vars`；依赖 junction 只指向 `reliability30/node_modules`，未安装包。
- 新 context 以本机 `/from-aether` 正常访客进入，无手工签名 cookie；1440×1000、Chrome headless、标准动效、auto=true、backgroundTabs=false、UTC显示、三币自选。股票按原观察器在 route 发送前 EXCLUDED（单独计数），不伪装成功，不改 crypto 的 5s/15s/60s 频率。
- BTC/ETH/SOL quote/history 均为显式 route 合成。Date.now 原生推进；按绝对 UTC15m bar time 生成96根，已收盘OHLCV固定、盘中随真实经过时间变化；前95根 confirmed=true、末根 false，lastCompleteAt=末根起点。每次历史检查连续/唯一窗口、已收盘根不改写、新根精确15m、退出最旧/加入新根；metadata limitations含synthetic_fixture。
- 浏览器只准本机 GET，Worker outbound 全拒。非行情 route.fetch 禁重试/跟随redirect，先验证 Location 同源再交浏览器；统计正常访客重定向。拒绝非本机/写入、未知行情身份、页面错误、前台身份变化、数据断言失败或任一额度触顶。
- 最多32min总墙钟/650获准本机非静态请求/60static/20MiB数据/10MiB静态/单正文1MiB。长时从ready至少30min；targetEnd取ready后30min与第二边界后30s两者较晚值，以容纳正常下一次历史刷新和最终采样。刚过边界ready时可能需要延长，仍受32min硬截止；没有额外探测刷新。
- 原生每20s存DOM/可见状态/页面更新文本及CDP heap、DOM、listener、TaskDuration累计；每分钟进度。第一次自然边界检查follow/latest与前根confirmed读数；第二次预先缩放/Shift+Left保持历史锚点，跨边界后检查不跳转与End回最新。只报告TaskDuration累计，不声称longtask次数/FPS/无泄漏。
- 报告明确 real:false/fixture:true，长时成功只能 LOCAL_SIMULATION_COMPLETED；短启动 SMOKE_ONLY_COMPLETED，明确30min/两边界NOT RUN。结束清理有tearingDown标记，清理关闭造成的取消与运行错误分开。

## 运行入口

从本隔离工作树执行，harness自行启动并关闭Miniflare，无需另开服务器：

```powershell
$env:RADAR_RELIABILITY_ONLY='soak'
$env:RADAR_SYNTHETIC_AUTH='1'
$env:RADAR_PREVIEW_URL='http://127.0.0.1:5399'
$env:RADAR_BUILD_DIR='C:/Users/施文唐/Documents/ChatGPT/Market Radar/worktrees/reliability30/dist'
$env:RADAR_OUTPUT_DIR='outputs/soak-30min'
$env:PLAYWRIGHT_MODULE='C:/Users/施文唐/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
$env:BROWSER_CHANNEL='chrome'
Remove-Item Env:RADAR_SOAK_SMOKE_SECONDS -ErrorAction SilentlyContinue
node tests/browser/radar.mjs
```

Builder本轮**没有运行以上正式30分钟命令**。短启动同入口，改输出目录并设置 `$env:RADAR_SOAK_SMOKE_SECONDS='15'`；只允许1–20秒参数，短启动总硬截止20秒，ready时可用时间不足则提前结束。

## 自检与审计交接

固定测试文件 SHA256：market-reliability.mjs `8e19eac2b7aa64cb0ad4589fc353222c3e70230e40c808c8aac85c215ab9129e`；radar.mjs `78f638eb3886363d808e8441cb335fa25ba0304745b2c8d58db462a1dc7ccdcc`。源码未改产品，无全量重建/全产品重测。

- 两文件 `node --check`、定向 ESLint、`git diff --check` 已通过，无warning。
- 初次 `outputs/soak-builder-smoke-1` 在约1.17秒因观察器读303正文失败而停止，0行情/0外发。修正只读本机redirect处理；原证据保留，不称产品失败。
- `outputs/soak-builder-smoke-2`：修正后17.932秒总/15.014秒前台，短启动完成，11非静态/11static、4批crypto quote、ETH两份history，0外发/0pageerror。
- `outputs/soak-builder-smoke-3`：加入独立审计提出的结束清理竞态修正后17.850秒总/15.011秒前台，11非静态/11static、167110数据bytes/1494366静态bytes、1股票请求EXCLUDED；pendingAtTeardown0、0外发/0pageerror。console只有1条预期股票blockedbyclient。
- 最终固定SHA版本 `outputs/soak-builder-smoke-final/soak-smoke/verification.json`：04:54:28.118–45.961Z，总17.843秒/前台15.009秒；SMOKE_ONLY_COMPLETED，11非静态/11static、167089数据bytes/1494366静态bytes、1股票请求EXCLUDED。三币各4份quote、ETH两份history；quote及走势显示时间从04:54:29推进到04:54:44 UTC，native visible始终true；0外发/0pageerror/pendingAtTeardown0。起止截图已视觉检查，未见溢出。
- 独立 GPT Auditor 已完成派发前与整合后只读 VERIFY；两测试文件hash未变，范围与隔离符合任务。Builder没有运行正式30分钟；主协调者于04:57UTC启动，结果在下方后续记录，生产来源持续健康仍不能由本地模拟证明。

## 主协调者正式运行 — 2026-11-06

整合为reliability30/ed59e981d7967849c5b881da0835b5c115ecac47后，从该工作树使用上方入口，输出改为`outputs/live-soak40-nov6/local-30min`（未设置SMOKE参数），一次正式运行exit0。04:57:21.448Z开始、04:57:24.147Z ready、05:27:24.274Z结束；原生前台1800.020秒/总1802.826秒，Chrome148.0.7778.217/1440×1000/标准动效。生产构建与上方hash一致，没有产品改动。

LOCAL_SIMULATION_PASS：13项最终完整性检查通过，91采样/6截图；361批报价、183份history、547本机非静态/11static，正文3372638/static1494366bytes；0浏览器/Worker外发、0pageerror、结束pending0。股票27次排除造成27条预期console，不能称零console。两次05:00/05:15UTC边界旧根来源确认/新根未收盘/96窗口推进正常；44根历史视口的绝对端点01:00UTC保持，End回最新成功。完整窗口最大请求间隔quote5015ms、ETH15013ms、BTC60011ms、SOL60010ms。

证据在协调者工作树`outputs/live-soak40-nov6/{local-plan,local-analysis}.json`、`local-30min/soak/verification.json`及截图；正式输出身份为real:false/fixture:true，无生产数据。运行结束前冻结持续性守卫并完成统计规则复核，完整结果的独立最终审计见父卡。这里只归档本地补证切片，父[MR-MARKET-LIVE-SOAK](../MR-MARKET-LIVE-SOAK.md)的生产30min/真实跨bar继续BLOCKED，真机NOT RUN。
