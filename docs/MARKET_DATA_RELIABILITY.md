# 行情刷新与 K 线可靠性专项

任务：MR-MARKET-DATA-RELIABILITY。日期：2026-11-05（Asia/Shanghai）。本文件区分代码候选、隔离验证和真实线上观察，不把模拟输入当生产行情。

**后续发布已完成：Sites v37 / source2d2d08b，PR#13正常合并，PR与main CI各761/761通过，独立包装审计通过。** 生产环境仍revision3，原网址及AI关闭保持。发布后2次请求确认入口303/首页200，但首页出现验证相关标记而停止；后续行情刷新BLOCKED/NOT RUN，不宣称全面恢复。详见[发布归档](../tasks/archive/MR-PUBLISH-MARKET-RELIABILITY.md)。下文为开发阶段交接记录；其“未上传/未部署”描述属于发布前时点，不能覆盖本段最新结果。

## 基线与边界

- 开始时 fetch 后 GitHub main：`4352b732660dbfd200d629d5f6d1b3349687a6e1`。远端 CI `39925525573` / job `120320829913` 成功是重新核对的历史执行，不是本轮新 CI。
- 原生 Sites 记录：v36，源码 `84511bfdf4189db7a0495e82a52727aeb72a7401`，deployment `appgdep_6adb1ab239988191a1763fe8955c36b7`。站点仍为 `https://market-radar-rex.swt-aether.chatgpt.site`。本轮没有重新部署，也未变更访问、代理配置或秘密，现有生产 v36 继续运行。
- 开发使用独立 `worktrees/reliability30`；其余原工作树及用户成果保留。最终产品候选 `1aac399`；原审计对象 `97c2c3e`，修复末端延迟 `648010e`，再修正报价时区标签。后续报告/测试提交不等于再次改变生产产品。
- GPT/Codex 完成规划、三个隔离实现切片、集成与独立审计。开发 DS 未调用，产品 AI 调用 0；未访问 AI 账本、私人解释文件或真实自选数据，未采集历史数据。

## 复现与根因分类

| 问题 | 本轮证据 | 处理/边界 |
| --- | --- | --- |
| 2026-10-23 BTC/ETH/SOL 历史 503 | 历史发布记录，无上游诊断 | 不能推定唯一根因或把今日结果追认到当日 |
| 当前 ETH 历史失败 | 11-05 09:07 UTC 正常访客入口后，BTC 200、ETH 503，公开错误为等待限流恢复 | 仅证明站点边界报告限流；真实上游 HTTP、远端代理路径和内部请求数 UNKNOWN |
| 拒绝后换端点请求 | 旧源码离线 403 触发 4 个请求 | 403/429 等立即终止；冷却覆盖同来源不同历史/报价路径 |
| 缓存伪装新获取 | 旧 Yahoo 缓存两次读取只请求一次，但 fetchedAt 前进 1,000ms | 保留实际获取时间；readAt/cache 与事实新鲜度分开 |
| 局部失败被吞 | 旧主图丢 fetchedAt，小图 catch 无状态，缺失报价结果未报错 | 每条链路保留失败与旧时间；无效分析基线不得形成新结论 |
| 旧收盘/周期假设 | undefined confirm 被显示已收盘、Yahoo 按固定 15m 推算 | 来源确认、时间窗口结束、未知分开；实际周期元数据贯穿 |
| 新候选 Worker 请求选项不兼容 | 实际 workerd 拒绝 redirect:error，0 次出站；普通 Node mock 未发现 | 已改 manual 且终止 3xx，不自动跟随；保留初次失败报告并复测 |

本轮真实诊断仅 **3 次外层 HTTP、11,693 bytes、3.641 秒**，并发 1、重试 0。访客入口 303；BTC 1d 返回 96 根（95 来源确认、1 未收盘）；ETH 503 后停止来源探测，SOL/quotes/direct 均 SKIPPED。未通过换域名、凭据或身份绕过。旧生产内部尝试数不可观测，不能声称 3 是全链物理请求总数。

证据：`outputs/reliability30/live-before/report.json` 和 `report.md`（本地忽略目录，脱敏；不含 Cookie/Key）。

## 取数、接续与展示

1. 报价和历史保留原轮询节奏。股票合并为一个最多 28 标的请求，由服务端最多 4 个 worker 有限执行；加密报价复用共享 ticker。相同历史身份的主图/分析/小图加入一个请求；仅 OKX 15m×96 的两个显示范围允许合并。
2. 手动刷新绕过页面 5 秒读取缓存，加入已有在途工作，并等待报价、当前图表和当前分析基线。来源自身的缓存仍保留原时间；不会把手动点击等同于重新产生市场事实。自动监控关闭时，恢复网络/可见性不自动派发。
3. 新请求的 then/catch/finally 都核对归属代次；旧结果不能覆盖新资产/范围。单个消费者取消不误杀其他消费者，全部离开才取消底层。代理取消不可观测时不启动重叠的直接回退。
4. 失败保留同身份旧图、真实时间和明确错误；历史失败作为有效性准备层的拒绝条件，不能用旧基线触发新的 Signal/State。新成功清理错误；时钟越界仍按原有效期判断。价格提醒仍按既有 quote.error/session/freshness 规则。
5. 完整数据契约见 [RELIABILITY](RELIABILITY.md) / [API](API_CONTRACTS.md)。时间戳仍是毫秒；fetchedAt、readAt、开盘、结束及检测时间分开。加密资产主图 1d 是滚动窗口，不保证自然日；股票为最近交易日，1m 是月。时间显示用设备/UTC/北京时间，保留来源原生分桶，历史夏令时按具体日期计算。
6. 同 bar 值/确认变化、追加、旧数据滚出与修订仍通过原 reusePoints 比较。选择和手势锚定时间，缺口不补点；折线断开、MA7/25 重新等待完整窗口。显示时区不改变数据、请求、视窗或算法。

用户入口：主价格旁报价时间/状态、图表底部来源/实际周期/错误提示、可展开“数据时间与状态”、概览小图失败提示；运行设置中新增显示时区。报价、走势和分析基线分别说明，部分成功不等于整体健康。

## 已执行验证

设备：Windows 10.0.26200 x64、Intel Core Ultra 9 275HX / 24 logical CPUs、Node 24.22.1、Edge 149.0.4022.98。浏览器为本机 headless Edge，含触控模拟；不是 iPhone 真机。

| 环境 | 本轮事实 | 限制 |
| --- | --- | --- |
| Node 离线完整回归 | 761 个用例，760 PASS、1 SKIP、0 FAIL；最终产品 1aac399 的全量执行见 node-final.log | Windows 文件符号链接权限缺失跳过 1 项，junction 覆盖仍执行；不把包装 npm test 冒称已运行 |
| TypeScript/build | Windows Node 24.22.1 实际 `vinext build`、`scripts/typecheck.mjs` PASS | 本地命令分开执行；未 push 新 CI |
| 受影响 lint | 39 个源码/测试文件；4 errors、4 warnings | 全是基线已有 main hydration、viewport ref/purity 与 monitor export 问题；未放宽规则；新文件无新增 lint 问题 |
| 生产等效 Worker | 核心候选 97c2c3e 及末端提示修复后 648010e：各 16 PASS，10 代理 fixture + 1 ticker fixture、0 真实/意外网络；实际 body timeout 约 6 秒（两次原始耗时见 runtime*.json） | 合成代理/身份/OHLC/HTML/JSON/401/403/503/429/冷却/访客 root/RSC/写入边界，不冒称生产代理已更新 |
| 图表真实浏览器组件 | Edge 149 五视口交互、0 API/外部请求/页面错误 | 合成 K 线；非手机真机；整页证据见下行 |
| 整页前后截图/回归 | 648010e：125 项 PASS，五视口 17 张截图；对照基线 4352b73 为 51 PASS / 48 个已知基线失败。最终产品 1aac399 另完成五视口三状态 15 张截图/15 项无横向溢出检查、正常计时联合场景 7 PASS | 同一固定行情、同一窗口、同一状态，独立 Worker 构建；旧 125 项没有冒充 1aac399 全量重测，后续产品改动仅时区标签 |
| 独立 GPT 审计 | P2 末端延迟提示已修复并 VERIFIED；视觉检查追加的旧报价 DST 标签问题也已独立 VERIFIED；最终 e441d28 报告/测试 diff 与原始证据复核完成 | 两处报告口径建议已修正：1d 加密/股票区别、15 项截图溢出检查与旧 125 项行为检查分开；不冒称审计员亲测所有浏览器场景 |
| 线上真实观察 | BTC 成功、ETH 限流错误后停止 | 不能宣布整个来源恢复；登录后完整用户流程及本候选线上刷新 NOT RUN |
| 真机 / FPS | NOT RUN | 视口模拟和字节数不能代替真机/高刷测量 |

完整测试有本地测试 Vite HMR 端口占用警告（24678），没有导致测试失败；这是测试进程观察，不归为生产浏览器警告。

执行入口：

```text
node node_modules/vinext/dist/cli.js build
node scripts/typecheck.mjs
node --experimental-strip-types --import ./tests/register-types.mjs --test tests/*.test.mjs
node --experimental-strip-types --import ./tests/register-types.mjs tests/reliability-runtime.mjs dist outputs/reliability30/runtime.json
```

整页复现入口仍为 `tests/browser/radar.mjs`，使用 `RADAR_SYNTHETIC_AUTH=1`、`RADAR_RELIABILITY=before|after`；补拍/正常计时分别使用 `RADAR_RELIABILITY_ONLY=screens|continuous`。只有 loopback，出站请求拒绝；不读取真实凭据。实际产物分别在 `outputs/reliability30/browser/{before,after,before-screens,after-screens,before-continuous,after-continuous}/verification.json`。原始报告保留测试工作树提交与实际受测构建提交，后续文档提交不改写受测身份。

五视口为 1440×1000、768×1024、390×844、320×740、844×390；状态为正常、失败保留旧图、恢复。截图时 UTC、固定模拟时刻 2026-09-14T08:00:00Z、同一 BTC/ETH/NVDA fixture，自动监控关闭；正常计时子场景单独开启自动监控与标准动效。所有整页运行均 0 pageerror / 0 外部请求。完整候选场景记录 21 条预期 console warning（11 条 monitor 401、10 条注入 history 503）；基线 6 条 monitor 401。正常计时前后均无 console warning，不能把此结果写成整套零警告。

可直接核对的截图（本地忽略目录，不含真实用户数据）：

| 同条件状态 | 修改前 4352b73 | 修改后 1aac399 |
| --- | --- | --- |
| 桌面 K 线 / 未知收盘状态 | [前](../outputs/reliability30/browser/before-screens/desktop-healthy.png) | [后](../outputs/reliability30/browser/after-screens/desktop-healthy.png) |
| 320px / 失败保留旧图 | [前](../outputs/reliability30/browser/before-screens/narrow-failed-retained.png) | [后](../outputs/reliability30/browser/after-screens/narrow-failed-retained.png) |
| 390px / 恢复 | [前](../outputs/reliability30/browser/before-screens/mobile-recovered.png) | [后](../outputs/reliability30/browser/after-screens/mobile-recovered.png) |

正常计时联合观察持续约 18.5 秒：缩放、拖动、Radar 往返、本机会话历史往返和键盘操作与报价 5 秒/股票 15 秒、选中历史 15 秒刷新共存。前/后记录到 9/7 个页面行情请求、0/0 个观察到的长任务；后台实际物理请求数不能由这个 fixture 推断。后版操作脚本耗时分别 59.79/62.10/140.26/88.12/7.64ms，包括自动化执行，不是输入到绘制延迟或 FPS。有效数据时间确实从 08:00:00 更新到 08:00:17，手动周期保持。仅一次有限本地观察，不足以推导性能提升比例；未做堆内存/真机/长时稳定性测量，不进入 Optimizer。

最终候选 server 构建 SHA256：`c1d38233adfc5d52e658d159a09a1a569e6baf13e1056a08d2cbfc986c0b84f3`；对照构建：`d77d68a0d0e324d51b52988b6ac964600877c5e4e3e9ea6867b119e21fd1f9df`。在相同生产构建方式下，market-radar chunk：866,258 → 887,486 bytes；gzip 263,224 → 270,111 bytes（+6,887）。这是包体成本，不代表运行帧率。

## 变更位置与十项验收索引

主要改动：`lib/market-request.ts`、`lib/market-data.ts`、`lib/okx.ts`、`lib/market-history.ts` 与 quotes/history API；`lib/market-client.ts`、两个行情 hooks、`app/market-radar.tsx`；`lib/market-time.ts`、时间 Context、图表和现有 Radar 时间调用点；共享类型/历史失败准入、少量状态 CSS 与 monitor 兼容字段。新增和扩展离线、Worker、浏览器测试；没有新增依赖或修改 AI/访问门禁。

| 用户要求 | 实际结论 / 证据 |
| --- | --- |
| 1. 反馈复现 | 拒绝后叠加请求、缓存时间变化、局部错误丢失、未知收盘误标、旧末端和夏令时问题均有离线或浏览器证据；历史 10-23 的真实 503 无法追溯唯一原因 |
| 2. 更新失败根因 | 已修复确定的链路/缓存/异步缺陷；本次线上 ETH 只确认站点报告限流，远端内部原因仍 UNKNOWN |
| 3. 共享接续 | 报价按资产结果共享；图表/小图/分析同身份加入在途，手动/恢复/自动关闭覆盖 Node 和浏览器用例 |
| 4. 保留与禁用 | 同身份旧图保留，失败分析输入拒绝；新成功清错。限流遵守冷却，不以清错或缓存读取刷新市场事实 |
| 5. 时间口径 | API 毫秒，获取/来源/bar 结束分开；range 与真实 interval 分开；UTC 分桶保持，显示时区可切换且按历史日期处理 DST |
| 6. bar 生命周期 | 同 bar 值/确认更新、追加/滚出、修订、冲突重复、缺口、未知确认有 Node/图表用例；无补点或强行确认 |
| 7. 旧功能 | 股票分组/部分失败/缓存、访客 root/RSC/写入边界、图表拖动缩放键盘/返回周期通过相应用例；真实股票实时供应和真机未新测 |
| 8. 验证层 | 本轮本地全量、Worker、浏览器、独立审计完成；CI 只有历史 main 成功记录，真实源仅有限观察，候选线上未测 |
| 9. 外部条件 | ETH 来源/远端代理内部需恢复或诊断；冷却实例间不协调，远端 monitor 尚未同步；上传部署与有限线上复测需本专项授权 |
| 10. 用户入口 | 主价旁报价时间/状态、主图来源/周期/失败、数据时间与状态展开区、概览小图错误；部分成功不会遮掉失败链路 |

## 审计与最终状态

独立审计原 P2：获取时间新但 K 线末端旧，原页脚未提示。648010e 单独标记已知 OKX 现货的末端延迟，复用既有一周期加容差，不影响股票休市或确认字段。独立离线复核已通过。视觉复核另发现报价标签使用当前时区偏移，会与 DST 切换前的旧报价相冲突；1aac399 改用报价时间的偏移，并消除重复 UTC，独立验证通过。

本轮不上线，不开启模型，不自动发布 monitor。

- CODE_FIX_VERIFIED：PASS（独立源码审计及两个修复 VERIFY；原有 lint 限制见上表）。
- LOCAL_RUNTIME_VERIFIED：PASS（Worker、五视口行为/截图、正常计时联合观察；模拟/真实与版本范围见上表）。
- LIVE_SOURCE_CHECKED：有限观察完成，部分来源失败，非全面 PASS。
- PRODUCTION_REFRESH_VERIFIED：NOT RUN（本候选未部署）。

剩余动作集中为一次发布决定：上传当前分支 → 候选 CI/PR → 审阅并合并 → main CI → 原站点部署 → 有限生产访客/行情后续刷新复测。此决定不包含秘密变更、远端 monitor 自动升级、新资源或 AI 启用；当前任务第 14 节要求核对对应授权，本轮未取得对该新候选的发布授权，旧 UI 发布授权未自动沿用。若获准，保留有限生产复测预算，遇拒绝/限流仍停止。上游或远端代理问题不能靠前端重试掩盖。专项后回接 MR-30-AI-PRODUCTION-DELIVERY，未开启另一套 3.0 路线。
