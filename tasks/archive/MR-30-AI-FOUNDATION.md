# MR-30-AI-FOUNDATION — 2026-10-07

## Planner / scope

3.0A Foundation：已有事实 → 有界运行时 Context/Evidence → 权限投影 → Provider → 输出/引用/一致性校验 → 共享请求状态 → Radar轻量解释 → 固定评估。2.9按用户本次决定收口为 Real Data & Research Foundation；分钟与其他未达目标保留Data Track，不再阻塞本任务。不开3.0B/C、不买服务、不调用真实模型、不采集分钟、不发布。

基线main/本树HEAD `de6eb05a0f6ba716c3c75f6e5db788c47feecb71`，本轮读取对应CI37128997504 completed/success（旧main证据）；Sites get_site本轮确认active/v32，源码据发布记录 `4a4b7fb66ac4fc10663087b42a09e08c55804e2a`，非生产登录验收。独立 `worktrees/ai30a` / `codex/mr-30-ai-foundation` 从干净information29建立，未混入分钟diff。

原minute29 HEAD2ad86814/8 modified+4 untracked；minute-gate29 HEADde6eb05/9 modified+5 untracked，均staged0。本輪隔离实施期间记录26个原文件指纹，保存outputs/ai30a/entry.json；记录时间不冒称任务前。前轮381/1skip、399/1skip分别为其历史准备测试；真实分钟0，CM访问/内部用途仍缺。只读保留两树，原卡不删除，不发送待授权的新稿。

## 实际职责与信任

父组件持有quotes/trends/时钟，并一次派生selectedState、selectedRadar；Context Builder仅投影它们，不运行第二套检测/金融计算，不读watchlist/alerts。浏览器事实标client_declared，不因schema正确视为服务端可信。当前公开数据的模型外发均UNKNOWN，默认删除；无受控实时snapshot/持久消费预算/产品API授权，因此真实Provider保持关闭。

服务端在现有Worker门禁后增加`/api/interpretation`：GET仅返回模式；POST仅接受固定scenario和symbol，不接受客户端Context/Prompt/model/key/URL/权限。仅本地loopback且服务端`AI_FIXTURE_ENABLED=1`能启用fixture，生产默认provider_not_configured；普通URL参数不能开启。服务端从自己生成的合成市场snapshot复用原State规则建立fixture Context，再走相同投影/预算/Provider/验证链。服务端不把客户端任意JSON背书为事实。无Node/fs/SQLite导入Worker，不新增依赖。

Radar演示输出明确“演示结果 / 未调用真实模型”，依据独立合成资料而非当前报价；返回受控证据索引以固定显示依据。真实当前Context仍可本地组装/查看限制，不发送外部网络。Classic仅跳转/必要状态，两视图消费父组件同一请求Hook；切资产取消，晚到结果拒绝，不额外保存第二份Context。

## 契约

- Zod严格schema统一TS类型。Context含完整asset、schema/contextId、capturedAt/asOf、trust、rule/data/projection版本、有界Evidence（资产/币种/来源/窗口/方法/分类/数值单位）、明确限制与截断说明。以规范事实内容生成摘要，摘要不是数据认证。所有支持/缺失维度分别呈现；分钟历史研究unsupported/real_minute_research_not_verified；日频长区间位置not_computed，不发送多年数组或比较USD/USDT。资料仅固定来源信息，无关联不等于无重要消息。
- Evidence来源权限由模块内闭合profile决定：生成fixture可内部解释，当前真实来源AI外发unknown；客户端allowed=true无效。身份/币种/窗口不一致拒绝；必需限制不得静默裁掉。
- Output为summary、primaryObservation、supportingEvidence、conflictingEvidence、stateChange、historicalContext、informationContext、limitations、confidenceLanguage、evidenceRefs。结论采用封闭claim类型+evidenceRefs+metricRefs；文案限定为从证据渲染的已定义描述，避免自由文案绕过数值支持。模型不计算指标/写URL。系统保底返回缺失、冲突、过期与分钟未支持说明。不声称自然语言零幻觉。
- Metadata由系统绑定request/context/asOf/生成时间/provider/model/prompt/output/validation/usage；模型不能替换快照或引用。Provider接口接safe Context、固定版本/参数和AbortSignal，无工具/联网权限。

## 冻结预算 / 缓存

最多16KiB输入（保守输入Token上限16384）、输出16KiB/2048 tokens、reasoning0；超时5秒、并发1、队列0、默认重试0。fixture预算每scope每日100次/500000保守Token预留，发出前原子预留；派发后取消/超时/未知usage保留占用，不把额度全部退回。服务进程内计数仅演示验证，不冒称跨实例/重启生产日预算。真实开发API本批0次/$0授权。

缓存16条/TTL60秒，key含caller/projection/source/完整资产/事实摘要与全部版本/prompt/output/provider/model/config；in-flight相同请求合并。读取重新验证Context有效性/权限，结果固定绑定原证据，失效不可冒充current。只在点击解释时调用；render/行情刷新/切资产/导航/恢复网络不调用。提供取消与停止开关。

## 允许路径 / 切片

2026-10-07 补充最小接入：允许 `components/radar/official-information.tsx` 增加可选的已加载视图回调，父组件仅复用现有审核资料，不改变抓取、来源、显示许可或默认懒加载。该回调不授权模型外发。

浏览器使用既有 `tests/performance/server.mjs` 的本地生产构建运行器；允许仅增加测试环境开关 `RADAR_AI_FIXTURE=1` 注入 fixture binding。该运行器固定 loopback、合成认证、无云绑定且拒绝外连，不改变产品访问门禁。

Optimizer Gate 实测触发：同环境主chunk由826161增至905551bytes（+79390，+9.6%）。允许新增轻量 `lib/ai/limits.ts`，仅对解释模块按需加载；不动态拆分整个应用、不降低行情刷新/验证/信息。记录复测体积与首次模块加载代价。

组合测量复用 `tests/performance/fixture.mjs`，增加默认关闭的 interpretation 透传选项及单一 `tests/performance/ai30-foundation.mjs` 场景；运行器继续拒绝外连，无新平台。真实推进时钟、标准动效、行情 polling 保持，记录本地延迟、长任务、采样堆内存和 API 数量，不宣称真机 FPS。

A：本卡、ACTIVE/CURRENT_STATE/2.9主台账/分钟Data Track链接，简短docs/AI_FOUNDATION.md。
B：`lib/ai/{contracts,context,validation,provider,service,fixture}.ts`（有实际职责才创建）；必要`worker/ai-interpretation.ts`、worker/index.ts轻接入；tests/ai30*.test.mjs。
C：`components/radar/ai-interpretation.tsx`、`components/radar/use-interpretation.ts`，app/market-radar.tsx与radar-feed.tsx仅props/hook注入，app/ai.css与layout样式引入。
D：扩展现有tests/browser/radar.mjs，固定评估fixture及忽略本地证据。禁止金融算法/State阈值、行情刷新、提醒/认证语义、依赖/schema/生产配置重构。

GPT先完成核心契约；DS仅允许生成指定普通测试/案例资料，输入仅合成契约/代码，不发真实数据/偏好/密钥。接口稳定后派发一次、至多一轮具体修正，完整diff由GPT接收。独立GPT Auditor对固定完整候选只读审查，Builder仅修confirmed finding后VERIFY。没有测量瓶颈则不进Optimizer。

## 验收 / 测试

先冻结18类预期：up/down/mixed；relative stronger/underperforming/unavailable；RMS higher/lower；transition available/unavailable；active/no signal；有/无官方信息；stale/partial/insufficient；分钟研究未验证。并测伪引用/方向与单位/跨symbol/window/version、neutral伪造、历史统计伪造、因果/预测/买卖/百分比、注入、未知权限、限制裁剪、超限/JSON/refusal/incomplete、预算/缓存/取消/乱序和无配置零真实网络。固定fixture E2E必须走应用POST和验证，不把fake JSON当完成。

稳定后Node全量、Vinext build、生成声明typecheck、受影响eslint；沿原浏览器harness五视口1440×1000/768×1024/390×844/320×740/844×390，键盘/44px/错误取消/手动周期与三档动效、行情图表并行。记录pageerror和警告；fixture/真机/生产与历史/新测分列。Phase4真实模型NOT RUN不阻塞Foundation。

## 本轮实施交接（2026-10-07）

状态 LOCAL_FOUNDATION_COMPLETE / AUDITOR_VERIFIED。32项定向、全量418项（417PASS/1既有Windows权限skip）、build/typecheck、新代码lint、最终构建五视口6组AI路径通过。主文件3处既有lint错误及5警告经原基线同环境对照，不冒称全文件通过。真实时钟/标准动效桌面与手机各约33秒组合测量、源码及体积证据已保存；未测真机FPS。

独立GPT审计确认两个P2：合并调用取消归属、动态加载不受客户端截止控制。均已修复并分别VERIFY PASS；增加两种取消顺序/最后等待者与实际Hook超时/取消测试。最终29文件候选、报告和原26文件保留证据复核VERIFIED PASS，无未解决confirmed finding：[AI Foundation](../../docs/AI_FOUNDATION.md)。DS实际两次受限开发辅助，仅发送合成代码，GPT拒绝错误的金融预期。真实产品模型0次，Phase4 NOT RUN；原生产Sitesv32未重新发布。未push/merge/tag/deploy、采集或改凭据。
