# MR-30B-REAL-CONTEXT-PILOT

2026-10-19，原MR-30B-REAL-PROVIDER-PILOT有限子项。Planner定稿；必要离线实施允许，真实取数/外发等待来源准入与具体用户授权，不push/merge/Ready/tag/deploy。

## 基线和目标

工作树worktrees/ai30b，分支codex/mr-30b-real-provider-pilot，起始干净，HEAD/PR#6=cd902372c3c14b67d5b16b668b28849bbfd84231；Draft未合并，main7d2d30f6fe466a4e746ade2b3db231b2cb13b2d4。远端CI39228845333本轮只读核对success，507/507是旧候选执行事实。生产仅沿用Sitesv32/source4a4b7fb记录，未新测。保留其他工作树/旧失败/原账本。

目标：一条同源页面→私有Node服务→受控snapshot→原编号选择→同快照A/B/C对照链路，当前仅完成不外发的准备及隔离验证。无新State、Provider、价格profile、数据源、全市场取数或生产开关。

## 来源/授权决定

技术候选唯一BTC-USDT / OKX SPOT / USDT / UTC / 原生15m。复用getQuote(symbol,false)+getHistory(symbol,'15m')，1 ticker+1 recent candles逻辑请求，不使用全市场tickers或基准；旧适配器有有限域/历史fallback，准确披露最坏请求而不称零。不把15m图表标签当5m。96根范围仅当前State窗口，不做历史采集。

2026-10-19重新读取https://www.okx.com/help/okx-api-agreement（条款更新2026-07-28）：§3.4一般AI整合允许受其他条款约束；§9.4(c)明确限制用数据评估拟向第三方提供的AI系统。本次Market Radar产品质量对照不等于私人交易工具，因此为本次评估取得/计算及第三方推理用途DENIED，无适用例外记录；30日最小证据保存、私人衍生展示独立权利尚缺充分依据，UNKNOWN；原始数据公开第三方展示DENIED。该结论不扩大为所有私人交易工具AI推理均禁止。不得只改trust/rights或改为标签外发。Yahoo仅作为一个既有技术替代核对，条款当前999且无已取得用途许可，NOT APPROVED；CoinMetrics日频不满足分钟窗口。停止扩查来源。

真实输入授权尚未给出，旧合成授权不适用。来源许可到位后才集中确认：BTC-USDT/OKX/15m；仅四个Direction/RMS事实及完整身份/窗口/指标/方法/版本/时效/限制；DeepSeek官方deepseek-flash/none；最小输入/原始ID回复/校验/费用证据本机私有30日，原始96根不外发；仅本人loopback会话；首个手动当前快照后逐例审阅，最多3次且无变化不凑数；原11/20次/$0.0344574只是旧余额，执行前重查；原总20/$0.25、UTC月$8/派发$7不重置；无训练、公开、充值、部署。当前不申请无效的“用户同意替代来源许可”。

## 2026-10-19 后续来源推进（来源核对与获准询问）

用户“你推进吧”后重新核对HEAD未变、原未提交成果保留。本次没有产品改动、真实行情取数、模型请求、正式账本访问或新的测试执行。此前584项与浏览器结果仍属上一段实施证据，不改写为本次新测。

独立GPT定向核对既有Coin Metrics路线：Community文档的“最近7点”是细粒度Reference Rates限制，不是所有market candles的统一上限；此前coinbase-btc-usd-spot market-candles 403是另一项entitlement证据，不能混用。ReferenceRate原生周期没有15m；15m下Short/Medium分别使用7/13个收盘点，Direction与RMS使用同一窗口，RMS当前/参考在窗内切分；底层共用prepare仍要求至少22个连续完整点。综合USD参考价不能直接替换OKX BTC-USDT/USDT窗口。没有新行情探针，当前原生15m替代资格仍NOT VERIFIED。

2026-10-19官方cm-labs入口跳转Talos的Coin Metrics介绍页，列明Community Support为datasupport@talostrading.com。已准备一封精确询问：是否有免费单一BTC现货市场、当前22–96根原生15m完整窗口，及向DeepSeek发送必要派生事实进行最多3次私有质量比较/30日本机保存的具体用途。只是询问，不申请账号、购买或自动试用；不发送代码、行情、账本、个人信息或Key。另备OKX客服许可询问，明确项目拟向第三方提供，不能包装为纯个人交易工具。两稿在忽略outputs/ai30b/real-context/{coinmetrics,okx}-source-inquiry.txt，准备时均未发送，随后获准发送Coin Metrics稿，见下。

用户随后明确“允许发送这封具体询问”。2026-10-19 11:12 UTC通过已连接邮箱仅向datasupport@talostrading.com发出已审查原文、无附件；Gmail返回SENT，私有回执在忽略outputs/ai30b/real-context/source-inquiry-send.json。SENT不是送达或获得许可；未收到/核对回复。OKX稿仍未发送。此授权仅覆盖这封来源询问，不涵盖真实行情外发、数据采购或任何产品模型调用。

下一动作：核对该询问的实际答复，分别验证免费原生15m当前窗口与具体用途；没有答复或仅“API可用”不解除Gate。免费来源答复可行后才冻结实际身份/最小必要适配，并集中确认真实资料外发。付费、账号或地区限制不自动接受。未启用邮件监控或自动催询，不承诺后台继续运行；OKX稿可供后续经授权的官方支持沟通。

本次允许写入仅本卡、ACTIVE、现有报告/CURRENT_STATE及上述本地询问稿；不改source policy、loader、模型、预算或产品UI。对应源码审计与测试不重复；本次需独立只读核对来源证据、稿件与权限措辞。

独立GPT已只读核对两份询问稿与官方来源，唯一P3样本窗口措辞已按原State代码修正；最终独立VERIFY无剩余finding，记录outputs/ai30b/real-context/source-inquiry-audit.txt；审计员核对本地回执，协调者11:15UTC仅一次检查本询问线程，只有已发送邮件，无本线程回复。18个原产品/测试文件与此前已验证候选hash完全相同，git diff --check通过（既有LF/CRLF提示不等于错误）；因此本次不重跑产品测试。没有新开发DS/Product DeepSeek调用或费用。

## 冻结接线契约

- 源用途配置固定且默认关闭；权限证据/复核日期、技术TTL与合同期限分开。浏览器不能提交policy、Context、scope、模型、URL或预算。闭合最小证据仅short/medium direction/volatility；Relative/Alignment/Transition/Signals/资讯均not_included，minute研究unsupported，dailyPosition not_computed。
- 真实loader一次取数，无独立polling；严格核对symbol/source/currency/UTC/15m、confirm，复用State V2与prepareStateInput。已有fetch不能按等待者中断时，及时取消等待并丢弃晚到结果，不误杀共享请求，不声称已取消底层网络。
- registry持有克隆输入、实际依赖、scope与asset、政策/授权身份；创建和get/派发/缓存/返回核验权限。真实admission使用模块私有WeakMap绑定registry复核，不以可序列化trust布尔升权；旧合成入口仍只接受fixture。固定snapshot同一Context构造目录，旧事件不补造。
- result采用浏览器安全private-interpretation-v1 DTO，保持原fixture schema；明确synthetic/approved_real、modelSelected/systemRequired/systemAdded、同目录deterministicBaseline，严校上下文/引用/ID。Node目录/crypto/SQLite绝不进入浏览器。仅返回有界投影，不返回权限对象、原始bars/请求或账本行。
- 私有Node服务绑定127.0.0.1、精确Host/Origin、独立随机会话凭据与CSRF边界、JSON/大小/路由白名单。凭据不入URL、不转发上游/第三方、不存localStorage。固定预览上游代理原页面，不复制网站。真实使用须来源/用户授权可核验；默认拒绝真实取数/模型调用。
- 复用原ProductBudget，同一reserve事务关联固定MR-30B-REAL-CONTEXT-001子批次和原SYNTHETIC_PILOT_ID计数键。添加式批次表显式启用（本轮仅临时库演练），最多3次跨重启保留；失败/未知占用不退款，质量错误持久停批，不改变旧profile/旧金额或新建财务库。正式库本轮不迁移/写入。
- 页面共享原useInterpretation，手动请求；真实模式60s整体截止覆盖≤25s loader+30s模型，旧fixture保持6s；结果绑定asset/context/snapshot，旧结果说明原时间，取消/切资产丢弃晚到。对照同样版式，精确证据DOM入口按组件实例+context区分，减少动效不影响交互。

## 允许路径/分工

核心协调者：lib/ai/{snapshot,real-service,private-contract,real-context-policy,real-context-loader,private-runtime}.ts，scripts/ai30b-private.mjs；必要原函数导出、定向lib/ai测试；现有docs/AI_PROVIDER_PILOT.md/API_CONTRACTS.md/CURRENT_STATE.md、原任务卡/ACTIVE/本卡，忽略outputs/ai30b-private。无修改State/行情源/刷新策略。

独立Builder可在专用worktree写lib/ai/product-budget.mjs、必要批次常量及专属tests/ai30b-real-batch.test.mjs；另一Builder可独占components/radar/{use-interpretation,ai-interpretation}.tsx/ts、app/market-radar.tsx一处模式文案、app/ai.css必要已有规则、tests/browser/radar.mjs相关分支与专属UI测试。接口先由协调者冻结，各Agent不写ACTIVE。开发DS无本次具体载荷授权，不外发真实输入或仓库；GPT承担实现及独立审计。

## 测试/验收

先专项：loader参数/身份/取消；registry作用域/资产/TTL/依赖/撤销与伪admission；未批准派生依赖不残留；旧合成拒绝真实；DTO版本/精确引用；私有Host/Origin/会话/CSRF/参数/上限；子批次同事务/重启/unknown/旧11条不变；同快照对照和质量停点。mock transport+临时数据库，无Key误外连。

稳定后实际typecheck/build/相关lint/全Node及既有浏览器1440×1000、768×1024、390×844、320×740、844×390，键盘/动效/返回/手动周期/取消与失败保留；观察刷新/滚动/拖图，不凭纯函数时间声称FPS。无瓶颈不Optimizer。真实/私有模拟/真机/CI分开。独立GPT先复核高风险边界，最终审计固定diff与证据；finding最小修复VERIFY。

## 本轮交接

本地实现与隔离验证完成，未提交diff保留在原候选；最终全量584项=583PASS/1既有Windows symlink权限SKIP/0FAIL，build/typecheck与新核心/UI/测试lint通过。主组件整文件lint仍有基线相同3error/5warning，未借本任务重构。私有UI五视口6组、原fixture五视口8组均本轮PASS；分别0pageerror，5个故意503/2个故意429。生产/真机/用户本人试用NOT RUN。具体命令、输出位置、截图与限制见[当前报告顶部](../docs/AI_PROVIDER_PILOT.md)。

独立GPT审计确认并修复：代理Origin、准入记录可改写、DTO目录与来源未绑定、结算停批竞态、诊断写入期间过期/撤销检查、跨会话旧结果、质量错误提示/停批与证据方法/时效披露；对应负向测试及静态VERIFY，无剩余confirmed finding。正式账本、产品Key及真实行情未访问；真实Provider请求0。测试迁移与模拟11条兼容不等于正式库迁移。

REAL_INPUT_ADMISSION=BLOCKED；TRUSTED_SNAPSHOT=离线PASS/真实NOT RUN；REAL_CURRENT_CASE=NOT RUN；PRIVATE_UI=mock PASS/真实NOT RUN；MODEL_VALUE=UNPROVEN；ENGINEERING_REVIEW=受限准备可审阅（独立静态VERIFY）；PRODUCTION_ENABLEMENT=DISABLED。真实CLI仍默认关闭，没有接产品Key/正式库/真实证据保存；先补来源用途依据，再一次确认具体真实外发，后续完成真实启动与首个手动案例。未push/merge/Ready/tag/deploy，现有Sitesv32保持，主3.0B与独立Data Track继续开放。
