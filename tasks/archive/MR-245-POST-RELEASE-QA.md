# MR-245-POST-RELEASE-QA — 发布后证据报告

日期：2026-09-22，Asia/Shanghai。最终结论：**证据不足**。本轮可执行隔离验证完成；独立生产浏览器等待15分钟未观察到授权工作台后关闭，真机第5步仍未测，不能全面封版。

后续授权：用户在本报告完成后另行要求“上传发布吧，我准备开始2.5了”。据此将验收报告与脚本纳入GitHub历史；下文“未commit/push”指QA执行阶段，不表示禁止后续已授权上传。产品代码零变化，本次复用已成功的2.45 / Sites v22，没有重新部署或自动开展2.5，证据不足结论不变。

## 基线与范围

- 本轮开始 GitHub main（本轮 GitHub API 读回）与本地 HEAD：`fc36ac7f1cf7233f8eb350c661e6a3d92fa0cdc1`。初始工作区、暂存和未跟踪为空，ACTIVE 无冲突；新分支 `codex/mr-245-post-release-qa`。
- 实际生产：Market Radar 2.45 / Sites v22，源码 `6804b41f5c6763cc631c9919e24e93fd6a076bbc`；deployment `appgdep_6ab2163711948191b0f2ee7d7b943063`。本轮平台 API 再确认 succeeded、environment revision 3。这只是部署状态确认，不代表登录后功能通过。
- main 比生产源码只多 CHANGELOG、CURRENT_STATE、VERSIONS、ACTIVE 和发布归档五个文档；app/components/lib/worker 产品代码相同。本轮本地 fixture 测试对象为当前 main 产品代码，非修复候选。
- **现有生产版本已经上线；本轮未重新发布，未 push/tag/commit，未修改产品、生产设置或密钥。**
- 允许范围：任务与本报告、既有浏览器 harness 最小证据/安全补充、独立生产只读脚本、忽略的本地证据目录。未进入2.45.1/2.5，没有大型研究或 Provider 改造。

## 授权与环境

- 用户同意自行在新 Edge 窗口输入访问码；脚本使用空白临时 context，未读取/注入生产访问码、Cookie、请求头/体、未保存登录会话。只放行 GET/HEAD 及用户登录 `/api/access` POST；没有自选/提醒写操作、通知或故障注入。
- 隔离环境：Windows、Edge **149.0.4022.98**、Playwright、Vite `http://127.0.0.1:5176`。5175 被占用，未终止原进程。固定模拟行情及测试时钟仅在本地 context；自选/提醒、存储失败、离线模拟均在该环境。
- 检查了原 harness 的 `.dev.vars` 本地测试认证、quotes/history/monitor 拦截、存储初始化和写操作。新增 loopback URL 守卫，整套模拟脚本拒绝线上地址。未把它指向生产。
- iPhone：用户报告 **iPhone 16 Pro / iOS 26.2**，Safari（按本任务指定清单，独立 Safari build 未确认），正式网站人工自测。未收到截图/录像；以下为用户反馈，不是代理真机操作或桌面模拟。
- DS：**未调用**。本轮没有必须外发的任务，不把历史 DeepSeek 参与写成本轮参与。

## 验收矩阵

| 项目 | 环境 / 设备 | 结果 | 新测 / 历史依据 | 证据或限制 |
| --- | --- | --- | --- | --- |
| 生产部署版本 | Sites 平台 API | PASS | 本轮新查询 | v22 / succeeded / 源码6804b41；非登录后路径 |
| 生产访问码页 | 独立 Edge 生产 | PASS | 本轮浏览器已到达门禁 | 脚本输出 LOGIN_REQUIRED，未读输入内容 |
| 生产登录后核心路径 | 独立 Edge 生产 | BLOCKED | 本轮尝试后超时 | 15分钟内未观察到授权工作台，quotesObserved=0、blockedWrites=0；已关闭临时context。没有取得登录后路径证据，不判断为产品缺陷 |
| iPhone Safari 核心路径整体 | iPhone16 Pro/iOS26.2，生产 | NOT RUN | 本轮仅部分人工反馈 | 第5步 Radar/Chart往返和周期保留未测，因此完整路径不能PASS |
| iPhone 竖屏/地址栏、图表触控/页面滚动、设置/安全区、键盘/取消、横竖屏 | 同上 | PASS | 本轮用户反馈第1/2/3/4/6步通过 | 反馈原意“除了五未测其他的都通过”；没有代理设备截图或 Safari build 证据 |
| 手机资产详情 | Edge视口模拟390/320/横屏、本地固定fixture | PASS | 本轮新截图与浏览器 | 主事件/实际指标/限制保留、默认折叠、返回可达；非真机第5步 |
| 动效矩阵、持久化与价格光晕取消 | Edge本地fixture | PASS | 本轮48项浏览器中的相关用例 | 4组合、实时OS/user、刷新、storage fallback、真实运行中光晕（仅fixture延长时长） |
| 旧/无效设置迁移、入场与磁吸取消、失败提示 | Edge本地fixture | PASS | 本轮新增6项中的相关用例通过 | 3类迁移；真实运行中3个reveal被取消；磁吸offset清除；恢复无intro重播；storage失败可见告警 |
| Motion纯函数/bootstrap | Node本地 | PASS | 本轮3/3新测 | normalize/resolve、异常fail-open、唯一媒体监听与显式覆盖 |
| 首次会话/异常内容可见 | Edge本地fixture | PASS | 本轮48项已有入口 | 首次退出/重复访问不重播、hydration故障内容可见 |
| 开场幕布运行中OS取消 | Edge本地fixture专项 | PASS | 本轮新增第6项 | 先捕捉实际running CSS动画，再pause并延长fixture安全timer，使用真实媒体偏好事件取消；动画脱离running/paused、幕布display:none、恢复不重播。人为时序控制，非生产自然观察 |
| 事件/跨symbol/stale报价/历史门限/离线/部分覆盖/共享自选提醒 | Edge本地fixture | PASS | 本轮48项浏览器 | 原始假数据和事件仅context拦截，非真实异常触发；未新测expiresAt生命周期边界 |
| 全量Node/typecheck/build | main与生产同产品 | NOT RUN | 复用历史83/83与构建/类型证据 | 本轮无产品改动，避免重复；不能算本轮新测 |
| 产品修复与对应产品复测 | 无已复现产品缺陷 | NOT APPLICABLE | 本轮零产品diff | 测试脚本修正不等于生产修复 |
| 独立GPT审计 | 只读当前测试/报告diff | PASS | 本轮独立GPT初审及VERIFY | QA脚本P2漏检查pageerror已确认修复；复核要求同步6项/开场结果并收窄stale、响应测量措辞，已修正文档/脚本。独立Auditor未重复运行测试或访问生产 |

## 可复查证据与命令

所有截图/JSON 均在被忽略的 `outputs/post-release245/`；不提交原始日志、认证数据或测试市场数据到产品。

- `fixture/verification.json`：本轮 **48 checks、errors=[]**；五视口1440×1000、768×1024、390×844、320×740、844×390。受控时钟下8次导航额外API=0，integrationNavigationRequests=[]；这不是生产polling测量。
- `fixture/post-release-extra.json`：本轮最终 **6 checks、errors=[]**。专项入口，没有重跑完整产品suite。
- `visual/mobile-context.png` 与历史 `outputs/visual245/after/mobile-context.png`：同BTC-USDT、16:00 fixture、390×844、详情展开；人工对照主指标/限制/返回操作一致。当前面板高度642.70px，与发布前after一致；桌面485.33px。未为高度删内容，未声称像素完全一致或真机FPS改善。
- `visual/` 包含桌面/手机 chart/context/overview/watchlist/settings；`fixture/` 包含窄屏/横屏及Settings截图。人工查看当前与历史390px详情及320px截图。
- `historical-browser.json` 是原输出的历史备份，明确**不是本轮新测**。
- `production.json`：本轮门禁PASS、后续工作台等待BLOCKED；quotesObserved=0、blockedWrites=0，没有登录后截图或真实行情证据。没有凭据、Cookie、Authorization或请求体；临时浏览器已关闭。脚本末次措辞修改仅收窄未来响应记录说明，本轮没有执行到该段，不宣称已复测生产报价路径。

PowerShell，本轮工作目录为仓库根；PLAYWRIGHT_MODULE 使用已验证存在的本机安装路径。主要命令：

```powershell
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5176 --strictPort
node --experimental-strip-types --import ./tests/register-types.mjs --test tests/motion-preference.test.mjs
$env:PLAYWRIGHT_MODULE='C:/Users/施文唐/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
$env:RADAR_PREVIEW_URL='http://127.0.0.1:5176'
$env:RADAR_OUTPUT_DIR='outputs/post-release245/fixture'
$env:RADAR_MOTION='1'; $env:RADAR_INTEGRATION='1'
node tests/browser/radar.mjs
# 新终端：仅 RADAR_POST_RELEASE=1 + 上述本地路径，运行新增6项。
# 新终端：RADAR_VISUAL_PHASE=post-release、RADAR_VISUAL_OUTPUT_DIR=outputs/post-release245/visual，采集固定fixture。
node tests/browser/post-release.mjs # 独立GUI，用户登录；绝不传测试Cookie
```

## Findings / 修正

- QA-01（MEDIUM / P2，测试证据缺口）：storage-write-failure 子用例未收集/断言 pageerror，专项入口会直接写报告返回。独立 Auditor 发现；补上 fail.errors 断言/汇总，新增5项重跑通过。允许路径仅 tests/browser/radar.mjs。无产品修复提交。
- QA-02（测试时序，非产品缺陷）：初次补证在打开Settings后才检查一次性存储告警，告警已经消失导致断言失败。改为DOM加载后立即等待可见告警，再验证会话内选择；复跑通过，未降低预期或修改产品告警。
- 未发现可复现的产品严重回归；无明确性能瓶颈，不进入Optimizer。历史大包warning不扩成本轮优化任务。
- 最终独立GPT VERIFY：QA-01修复与证据分类确认，无剩余可证实finding；审计者未自行运行测试、访问生产或读取凭据。
- 收尾检查：两个浏览器脚本 `node --check`、`git diff --check` 通过；非loopback负向验证实际拒绝 `https://example.invalid`（预期exit1，在创建fixture/读取测试认证前失败）。仅关闭本轮5176预览，未动原5175进程。
- 本地Vite控制台曾记录Recharts容器0/-1尺寸warning；浏览器报告的errors=[]仅指pageerror，不等于控制台无警告。此次未复现可见图表损坏或量化性能问题，作为未定级观察保留，不据此修改图表或进入Optimizer。
- Awwwards：本轮未研究；历史Linear/Raycast/Codrops/web.dev记录不能替代Awwwards专项研究，亦不阻塞本轮。

## 最少待补 / 用户决定

1. 生产独立测试浏览器完成用户登录并实际走BTC/ETH→Context→Chart/手动周期，记录真实行情是否可用；无事件仅验无事件路径。未登录时保留BLOCKED。
2. iPhone第5步：当前资产→Radar详情→返回图表，手动选周期后再次往返；反馈资产/周期保留、返回可达和限制说明。尚未实测保留NOT RUN。

用户已经反馈其余五步通过；不重复要求全套真机测试。当前不建议以“全面封版”进入2.5；可以整理需求但不自动执行。无发布候选，后续如有修复仍需单独授权发布及对应线上复测。
