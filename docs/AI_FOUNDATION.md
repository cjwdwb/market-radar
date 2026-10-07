# Market Radar 3.0A — AI Trend Intelligence Foundation

2026-10-07，本地隔离候选。规则与证据解释基础，不是预测系统或真实模型上线。

后续上传（用户另行授权）：产品 `15535d600b9a9eadc1f80c57698c98c5dd7c8857`已到GitHub独立分支，[PR#5](https://github.com/cjwdwb/market-radar/pull/5)；tree `d1e29458dacf8b163c0a740d78f705143b29a6c2`与本地index一致。首轮[Ubuntu/Node22.15 CI](https://github.com/cjwdwb/market-radar/actions/runs/37632197422)执行npm test（含build/typecheck）418/418 PASS，0SKIP。后续仅补记录，产品不变；最新PR head/checks见GitHub。[上传归档](../tasks/archive/MR-UPLOAD-AI30A.md)。未合并main、未部署，真实模型继续关闭。下文“未上传、CI NOT RUN”等保留开发阶段时间与证据边界。

## 基线与路线

工作树 `worktrees/ai30a`、分支 `codex/mr-30-ai-foundation`，源码基线 `de6eb05a0f6ba716c3c75f6e5db788c47feecb71`。本轮读取 GitHub main 同 SHA，既有 CI37128997504 completed/success；不是本轮候选 CI。Sites 平台新读取 active/latest32；部署源码按发布记录 `4a4b7fb66ac4fc10663087b42a09e08c55804e2a`。未登录生产或使用真机，本輪未上传、合并或部署。

2.9 按用户本日决定收口为 [Real Data & Research Foundation](FOUNDATION29_HANDOFF.md)，原日期/覆盖目标归 [Data Track](../tasks/DATA-MINUTE-HISTORY.md)。未完成的真实分钟不阻塞这次 Foundation；分钟历史胜率、相似模式及真实研究继续禁止。原 minute29 / minute-gate29 未提交成果未混入；原档案的 BLOCKED / NOT RUN 不改写。

## 交付范围

```text
父组件已有 selectedState / Radar / Quote / 已加载官方资料
→ 纯 Context Builder（客户端声明，仅本地）

明确点击
→ 原 Worker 门禁
→ 本地开发开关 + 固定 symbol/scenario
→ 服务端合成 snapshot → 复用原 State / Engine
→ Provider-safe projection → 预算预留 / 去重 / 超时
→ deterministic fixture Provider
→ 结构 / 引用 / 封闭语义校验
→ 父组件共享结果 → Radar 详情 / Classic 返回
```

不增加行情请求、金融算法、State 阈值、独立检测 timer、数据源、依赖或 schema 迁移。官方资料仅经现有组件首次展开取得，回调复用已审核视图；解释入口本身不请求资料。长期日频没有获准区间位置算法，标 `not_computed`，不将 USD 与即时 USDT 比较。分钟研究明确 `unsupported / real_minute_research_not_verified`。

## 契约、来源与可信度

Zod strict schema 是 Context/Evidence/Output/Result 的统一运行时与 TS 来源。身份完整保留 symbol、market、currency；每项证据带窗口、可用性、有限分类、指标单位、规则/数据版本，必要来源/抓取时间、原生周期/点数/参考窗口与 benchmark 身份。来源刷新时间不冒充证据截止。

父组件本地 Context 不含整个自选、提醒、设置或数据库。暂停、离线或旧派生时间降级；不把缺失写成 neutral。事件与资料最多各3条，裁剪保留计数与限制；超出总输入大小拒绝，不优先删冲突。资料是项目/产品版本事实，不是财报、媒体新闻或价格原因。

| 输入 | 本轮 Provider 权利 / 决定 |
| --- | --- |
| 自有合成 fixture | 本地演示准入；服务器自行生成，不接受客户端伪造 Context |
| OKX / Yahoo 当前行情与派生状态 | 模型外发 UNKNOWN，真实路径关闭 |
| Coin Metrics USD 日频 | 已有网站展示与研究不自动授权模型外发，本轮不发送 |
| 官方项目/产品 / FED 元数据 | 已有展示许可不自动等于 AI inference 权利，本轮不发送 |
| 自选、提醒、偏好、凭据 | 不纳入 Context，不发送 |

source profile 闭合为 fixture，`client_declared` 或 `controlled` 真实 Context 拒绝。短摘要仅用于事实身份，不是认证；缓存还绑定完整规范 payload。服务端 POST 不接收 Context、Prompt、model、URL、key、allowed/token 参数。不存在对客户端任意事实签名背书的路径。

Output 包含 summary/primaryObservation/supportingEvidence/conflictingEvidence/stateChange/historicalContext/informationContext/limitations/confidenceLanguage/evidenceRefs。每个 Claim 必须引用本次唯一证据并使用其 metricRefs；限定为原分类的封闭描述语言。非法 JSON/额外字段、伪引用、反方向文案、错单位、跨资产/币种/窗口、错误分类栏目、遗失限制/分歧拒绝。UI 不回退原始自由文本，React 纯文本显示；本地证据按钮定位原索引，不用模型 URL。

封闭词汇用于降低第一版风险，不等于已证明真实模型零幻觉、金融预测能力或任意自然语言支持判定。Provider 不提供工具、联网、代码或数据库权限。主真实 Provider 方向为 OpenAI，本轮没有实现/试跑真实适配器。

## 请求、缓存与费用

仅按点击触发；render、行情更新、导航、换资产、展开证据、网络恢复均不触发 Provider。只允许 loopback + 服务端 `AI_FIXTURE_ENABLED=1` 的演示；生产即使误带该变量仍 off-loopback disabled。GET 返回 unconfigured；POST disabled503。沿用门禁；同源 Origin、JSON、流式16KiB大小检查。默认重试0。

输入16KiB / 保守16384 tokens，输出16KiB / 2048 tokens，reasoning0；服务5秒超时，客户端6秒兜底；并发1、队列0；缓存16条/60秒。每日每scope100次及500000保守 token 预留双上限：每次18432，最多27次未命中任务先达到 token 上限。派发后取消/超时/未知usage不退回额度；模拟usage与账单明确分开。此预算是单进程 fixture，不能称跨实例/重启持久预算。

缓存绑定 caller、完整事实/资产/时间/源与数据/方法/projection/prompt/output/provider/model/config 版本。读取先复核权利和时效。结果绑定生成时 Context，UI显示原 asOf，永不改绑当前行情。重复在途合并；每个等待者独立取消，全部等待者退出才中止 Provider。停止开关中止在途任务。切资产立即隐藏旧结果、取消请求，晚到响应不能覆盖新选择；取消/错误可以保留清楚标明的上次同资产演示。

真实产品模型调用 **0 / NOT RUN**；本轮真实试点费用 `$0`。真实启用还需数据模型外发权利、受控可信 snapshot、实际模型/保留设置、明确消费预算与相应授权，不能用开发 DS key 代替产品授权。

## 新测证据

Node22.15 / Windows，Edge149.0.4022.98 headless。当前未提交 diff 是测试对象，全部 fixture 与生产、真机分开。

| 验证 | 本轮结果 / 可复查本地产物 |
| --- | --- |
| 定向契约 / 固定评估 | 32/32 PASS，含18个预先固定场景及2项实际 Hook 加载超时/取消回归；`outputs/ai30a/targeted.log` |
| 全量 Node | 418项：417 PASS、1既有 Windows 权限 skip、0 FAIL；`node-final.log` |
| 构建 / typecheck | 分别执行 Vinext build 和 scripts/typecheck.mjs，PASS；`build-final.log` / `typecheck-final.log` |
| 新增及局部接入 lint | PASS，0警告；`lint-new.log` |
| 主组件全文件 lint | 3既有 set-state-in-effect 错误、5警告；与同版本基线对照相同规则/代码位置。完整受影响 lint 不称全通过，未为本任务重构老逻辑 |
| 应用 E2E / 五视口 | PASS；1440×1000、768×1024、390×844、320×740、844×390。6组路径：折叠/键盘/按需POST/合成标识/引用定位/缓存/44px/共享结果/手动周周期返回/取消/晚到跨资产/未配置；`browser-final/verification.json` |
| pageerror / console | 五视口 `errors=[]、warnings=[]`；仅此测量范围，无全站无警告保证 |
| 生产登录后 / iPhone 真机 / 新候选 CI | NOT RUN；本轮未发布/推送，桌面视口模拟不代替真机 |
| 真实 OpenAI 质量 / 保留 / 费用 | NOT RUN；不拿 fixture 或开发 DS 成功代替 |

实际命令以 `node --experimental-strip-types --import ./tests/register-types.mjs --test tests/*.test.mjs`、`node node_modules/vinext/dist/cli.js build`、`node scripts/typecheck.mjs`、受影响 eslint、现有 `tests/browser/radar.mjs` 的 `RADAR_AI30_ONLY=1` 为入口；Windows分别执行，不冒称执行了串联 Bash 的 npm test。浏览器用既有 Miniflare 生产运行器，合成认证、无云绑定、所有外连拒绝。

初次 RMS-lower fixture 边界跳变使预期变成 similar，修正合成路径的当前段；保留原预期及原 State 阈值。预算测试最初手算26错误，500000/18432实际最多27，按冻结上限修正断言。没有放宽算法或验证门槛。

## 性能、委派与审计

实测首次集成主chunk905551bytes，基线826161（+79390 / +9.6%），触发现有 market-optimizer。仅将 Context 与输出校验按需要加载并抽出轻量预算常量。最终主chunk825848；将页面入口、主组件及开场的全部静态依赖计入同口径：基线1103377 → 候选1114245bytes（+10868 / +0.98%）。全部JS仍1103665 →1184753bytes，功能代码没有消失，首次进入解释详情需额外模块下载。既有500KB警告保留，不称FPS改善。

组合测量复用原 performance fixture，真实推进时钟、标准动效、隔离行情/本地 Provider。仅在测试POST加入800ms等待以验证并发操作，不是供应商延迟。最终构建桌面33742ms / 手机33785ms的单轮中，解释等待时手动刷新行情、返回并拖动图表，持续 polling 未停止；每轮24次 quote / 14次 history（含初始分组、人工刷新及周期路径），非新Provider行情请求。工作流完成约2104 / 3108ms（包含800ms实验等待、自动化操作与等待结果，不是纯模型延迟）；采样最大堆27280312 / 26106192bytes，长任务2 / 0个。`outputs/ai30a/performance/verification.json`保留时间/采样/任务记录，无pageerror或console警告。没有匹配的前后交互基线，不声称页面提速或高刷；采样堆不是精确峰值，冻结时钟浏览器耗时不作性能比较。

DS开发辅助实际2次：第一次因执行 helper 故障无法读文件；一次定向修正仅给两份合成源码 inline，产出普通边界清单。两次共8098个报告 tokens，账单未知。GPT采纳 strict字段/数组/固定标识等普通建议，拒绝错误的 Relative缺失/Transition样本/partial金融预期。没有外发真实数据、完整仓库或凭据，也没有DS产品Provider。

独立 GPT Auditor 对完整未跟踪产品文件和稳定 diff 首审：confirmed P2 合并请求取消归属，已按 finding 修复并补两个取消顺序/最后等待者测试，VERIFY PASS。第二次复核确认 P2 客户端动态校验模块不受 fetch 超时约束；已让请求、模块加载和校验共用取消竞争，提交前复核取消状态及代次，并补实际 Hook 延迟模块测试。独立执行2/2 PASS、修复 VERIFIED PASS。Auditor额外独立执行144个合成场景×资产组合通过。最终29文件SHA、浏览器/性能/测试记录与报告、原两树26文件保留证据均 VERIFIED PASS，无未解决confirmed finding；最后复核只读核证，没有重复执行全套或浏览器。真实模型、生产登录、真机与候选CI NOT RUN。[本地完成归档卡](../tasks/archive/MR-30-AI-FOUNDATION.md)。

## 下一步 / 运行边界

本地演示：构建后使用现有 `tests/performance/server.mjs dist <loopback-port>`，只在测试进程设 `RADAR_AI_FIXTURE=1`。运行器合成门禁、拒绝外连、20分钟兜底，停止进程即可结束；不改生产环境变量。浏览器 `RADAR_SYNTHETIC_AUTH=1`，不填写真实访问码。

不自动启用3.0B/C、分钟采集或云调度。不 push/merge/tag/deploy、不购买或修改密钥。现有 Sites v32 继续运行；本輪3.0A未重新发布。Data Track、真实模型授权与可信输入、原主组件静态检查、真机增量回归分别保留，不用 Foundation 完成掩盖。
