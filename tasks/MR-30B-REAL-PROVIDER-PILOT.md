# MR-30B-REAL-PROVIDER-PILOT

## 2026-10-19 受控事实编号选择 — Planner 定稿

执行交接：付费前独立GPT审计2项P2/2项P3已修复VERIFY；本轮按原名单逐例9次DeepSeek真实合成HTTP200且选择/最低组织标准/披露均PASS，stale准入拒绝0HTTP/0预留（不是模型PASS）。旧两次FAIL原件6hash与10月13日历史交接一致。新费用占用上界$0.029139，原账本累计11次/$0.0344574，unknown/reserved0，剩余试点9次/$0.2155426；实际账单未知。最终507全量=506PASS/1既有Windows权限SKIP，build/typecheck/lint通过，真实执行后11源码/测试hash与付费前版本相同。证据`outputs/ai30b/selection-execution-handoff.json`；最终集中独立复核VERIFIED PASS，核对39份新证据/6份旧证据、逐例先审阅后调用、原库11条请求和费用，旧原始回复重放仍FAIL。本轮子项已交接并停止；仅本地候选，无上传/部署，真实市场解释与模型增益未获证明，主任务继续开放。

基线 f31ccc12b7547937a51428057b59d0d581fdae0c，原 PR #6 草稿，起始工作区干净。现有两次真实失败原件与 FAIL 保留；原账本本轮只读核对 2 次/$0.0053184、unknown/reserved 0，剩余 18 次/$0.2446816；不迁移/初始化/重置。专用产品 Key 仅确认进程存在，不读取开发 Key。10月19日官方 Responses/none/json_schema 与高峰输入$0.30/M、输出$1.20/M 未变；沿用用户已确认的总费用不超过2倍上界，实际账单仍未知。

范围：仅 DeepSeek 显式启用 claim-selection-v1；原 v1/v2 schema、validator、OpenAI、fixture/State/预算算法不变。一次 projection 后构造完整冻结 Context/目录/请求，服务端保管映射；SHA-256 preimage 包含 Context、全部协议版本、目录与顺序，不含派生ID。回复严格只有1–3个 selectedClaimIds，首项必须具备主观察资格。编号不充当授权，未知/跨上下文/重复/额外字段/不合资格均拒绝，不 trim/修补/回退。固定文案复用 synthesisCatalog，原 metricRefs 精确恢复。

披露：不可用证据、available mixed Alignment、可用短中方向差异、全部 Context.limitations 与 minuteHistoricalResearch 分别有明确来源及稳定ID。Context全局限制没有伪造Evidence引用。选项的 covers 在发前固定；systemAdded 按披露ID差集，不以共享refs/相似句子去重。raw model JSON、modelSelected、systemRequired、systemAdded、renderedResult分存；选择有效性、模型组织质量、完整披露独立判定。

冻结质量规则（只依现有事实，不依case名称）：有短中方向时模型须覆盖两窗方向；仅短窗可用时覆盖短方向；短RMS higher/lower 时同时覆盖其事实；已有方向分歧须有明确分歧命题，或双方方向加已有mixed命题这一等价组合。Alignment不足本身不是冲突。允许任一有资格主项及合理顺序，不要求选满限制，不强求transition成为主项。模型漏重要事实/分歧则组织质量FAIL，即便系统补齐也停止后续消费。确定性基线先取两窗关系（若有），再取短方向/RMS关系或可用金融事实，按新增事实/披露去重并最多3项；无数据不派发。基线仅供比较，不宣称LLM增益；相同输入须同一规则。

盘点限制：aligned/transition/no_events/information_missing/minute_unsupported在固定同一NOW下Context完全相同；所有原场景没有事件/资料正例；aligned的完整Alignment实际不足；stale没有可用主要金融证据，应NOT_DISPATCHED，非质量PASS。测试另覆盖mixed与Alignment不足同时出现等边界，不改变原付费场景。

允许路径：lib/ai/{claim-selection,real-config,deepseek-provider,real-service}.ts、scripts/ai30b-pilot.mjs、tests/ai30b-*.test.mjs、本卡/ACTIVE、docs/AI_PROVIDER_PILOT.md及忽略outputs/ai30b。real-output.ts加入指纹但不改旧契约；不改product-budget/schema、其他工作树、UI/生产配置。CLI先冻结再传相同prepared对象，来源指纹包含新模块和旧validator；缓存绑定完整冻结内容/版本/权限/profile。

测试与执行：离线全部阻断真实fetch，临时账本；编号/不可伪造映射/恢复/披露/质量/预算/取消/晚到/缓存/注入/旧FAIL回归；稳定后全量Node、typecheck/build、局部lint。无UI改动不重复浏览器。GPT独立审计并VERIFY后才aligned单例；逐例冻结/检查后继续原名单，任一质量/身份/usage/费用/诊断问题停止，绝不自动修Prompt重试。请求沿用原总预算与20次/$0.25上限，真实市场/生产关闭。本轮无push/merge/tag/deploy。开发DS不强制，尚未实际调用。

## 2026-10-13 真实合成首例与一次限定修正计划

用户已安全配置专用产品Key；仅在用户变量读入当前CLI进程，不读取通用开发Key。9个代码/测试哈希与上轮审计一致；原账本预检0次/$0。首个aligned真实HTTP200、模型deepseek-flash、input3628/output174/cached0/reasoning0，完成响应但原校验拒绝missing_conflict：模型把insufficient alignment错误放入conflictRefs。证据outputs/ai30b/synthetic-1791866444335-aligned-rYvgU8，失败请求不删除；高峰用量估算$0.0012972，2倍含费预算占用$0.0025944，billedCost仍null。真实连通已发生，不等于质量通过。

沿用原任务“最多一次依据明确的修正”：只在lib/ai/deepseek-provider.ts补明确的引用集合边界（conflictRefs仅kind=alignment且classification=mixed且available，无则空；不可判断只进入limitations，不凭空变为分歧），lib/ai/real-config.ts递增DeepSeek prompt版本，tests/ai30b-deepseek.test.mjs补正反例。原SYNTHESIS_PROMPT/OpenAI、schema、validator、fixture、金融分类、模型、费率及预算不改。先定向mock/lint/typecheck与独立GPT复核，之后只用原aligned新时效manifest验证一次；成功才逐例继续原名单，失败停止，不继续修Prompt或换模型。每个调用仍先预留、同原pilot/月预算。仅增加本卡/报告/索引及忽略的执行证据；无真实市场外发、上传或部署。

本轮实际结果：73/73专项、typecheck/局部lint及独立GPT限定修正VERIFY PASS后，发第二次原aligned合成请求。HTTP200，input3720/output205/reasoning0；conflictRefs已正确，但第一句删除原catalog固定前缀，原validator拒绝unsupported_claim。2次累计预算占用$0.0053184、unknown/reserved0，未对账账单。A1连通PASS、A2质量FAIL；剩余9场景NOT RUN，一次修正额度已用，停止继续调用和修Prompt。原失败manifest/账本完整保留；没有真实金融数据外发，不上传部署。详见报告2026-10-13节；旧“待Key/0请求”仅历史。

最终独立GPT VERIFY PASS：9代码/测试hash及6份执行证据hash一致，正式库与交接统计相符；唯一文档措辞精确化已修，无剩余confirmed finding。没有新增请求或改变A2 FAIL。当前任务以“真实试点质量未达标、停止剩余场景”交接，不归档成3.0B全部完成。

## 2026-10-12 DeepSeek切换补充（当前执行）

继续同一PR#6/HEAD62a0177及上轮未提交五文件成果，不重建Foundation。用户明确允许向DeepSeek官方发送自有合成场景并计入原共享预算；产品凭据使用`MARKET_RADAR_DEEPSEEK_API_KEY`，通用`DEEPSEEK_API_KEY`已明确不是本次产品Key，不读取复用。用户确认DeepSeek账户有额度，美元含税附加费不超过官方高峰未缓存费用2倍；产品专用变量待配置，未到位不调用。

官方2026-10-12契约：POST api.deepseek.com/responses，deepseek-flash，none，instructions为固定规则、user为不可信Context；developer被当user，禁止照搬。支持text.format json_schema但strict属性/完整keyword子集未获文档证明；发送schema而不声称供应商严格保证，原本地证据/冲突/限制校验不变。返回模型只接受deepseek-flash、opaque response ID有界、object=response；usage按Responses字段校验，incomplete/failed/未知计费身份失败关闭。无OpenAI service_tier断言。高峰未缓存输入$0.30/M、输出$1.20/M；缓存/低峰不用于预留或结算优惠，账单金额仍null。

允许路径：lib/ai/{real-config,openai-provider,deepseek-provider,responses-transport,real-service}.ts、lib/ai/product-budget.mjs、scripts/ai30b-pilot.mjs、tests/ai30b-*.test.mjs、现有任务卡/ACTIVE、docs/{AI_PROVIDER_PILOT,CURRENT_STATE,API_CONTRACTS}.md及忽略的outputs/ai30b证据。不改State/证据校验/UI/生产权限，不新增依赖。固定两个profile供原OpenAI适配保留与当前DeepSeek执行，非通用路由或自动回退。

账本最小添加式兼容：同一SQLite、同一pilotID和月/试点门槛不变；新增request_profiles记录每次provider/model/adapter/price/billing profile及原费率/倍率，metadata标v2。旧requests金额、状态、时间和ID逐列原样保留，旧记录赋已知OpenAI历史profile而不重新计价。显式一次迁移、事务提交，inspect不自动迁移；先临时v1副本演练迁移/重开/混合预算/失败原子性，独立审计后才备份并迁移正式本地账本。旧代码遇v2身份须失败关闭，禁止回滚旧备份绕过新消耗。原在途/unknown不清除。新结算用预留时固定费率，模型不符保留未知全额。

实施顺序：最小适配→mock/迁移与取消/诊断/单例专项→typecheck/必要构建与全量Node→GPT独立审计→符合条件时迁移原库→首个aligned合成请求→GPT同输入模板/usage/语义核对→按结果逐例继续。Key未到位不阻止本地工作；不进行未获准的真实市场外发、购买充值、上传合并或部署。实际DS产品调用与开发DS Worker分别报告。

当前实施结果：71/71隔离专项、489项全量（488PASS/0FAIL/1既有Windows权限SKIP）、build/typecheck/受影响lint通过。独立GPT迁移前代码审计VERIFIED PASS、无confirmed finding；审计员另在临时库以Node24.19验证6/6，本轮主验证使用Node22.15.0。正式原库已一致备份至data/local/ai-budget-before-profiles-y7DGYV并事务迁移v2，新进程逐列/哈希/quick_check一致，0请求/0占用不变。专用Key仍未检测到，不读取通用开发Key、不发探针或模型请求。实现和迁移不代表A1/A2实际调用或质量通过；具体证据、当前命令及历史边界见报告最上方DeepSeek节。

最终独立GPT复核VERIFIED PASS：9个代码/测试文件与审计版本哈希相同，正式库/备份只读逐列哈希和trigger验证通过，最新DeepSeek离线manifest来源与Context哈希匹配，文档准确区分历史/模拟/真实。没有confirmed finding或真实请求；不以该复核声称账户/API或模型质量已验证。任务保持开放，仅待产品专用Key后按原单例停点继续。

## 2026-10-12 单例执行补正（DeepSeek切换前历史）

继续 PR#6 / `62a01775558fb8afb7536f35148df14406e548d6`，不重新开发 Foundation。工作区起点干净；PR仍为草稿、未合并，候选CI38058872444 success为历史证据。原账本重新只读核对：2026-10月与固定试点均0次、占用0，未初始化或重置。用户本轮确认账户无可用API额度；A1 BLOCKED、A2 NOT RUN。Key存在性检查为false，不要求现在输入Key、不发付费请求、不充值。

最小 Builder scope：仅 `scripts/ai30b-pilot.mjs`、`tests/ai30b-cli.test.mjs`、本卡、`tasks/ACTIVE.md`、`docs/AI_PROVIDER_PILOT.md`。补单例白名单停点、逐例新建原始fixture、不可覆盖manifest、有界失败取证及区分HTTP/预留计数；Provider、校验、预算、场景定义与金融语义不改。保留原案例清单和固定pilotId，CLI取消初始化入口。每次只执行一个指定case，首次aligned后由GPT人工审阅才续跑，不能自动循环。

验证用隔离临时mock账本/transport；实际Key即使存在也不能触达网络。重点覆盖未知case拒绝、预算不重置、独立manifest、故意stale拒绝、失败仍计费/保留预留、HTTP与累计预留分离。仅运行受影响测试及脚本lint；CLI/文档变更不重跑历史449项CI、全量构建或浏览器。独立GPT只读审计稳定diff和本轮证据，必要FIX/VERIFY。无实测性能瓶颈不进入Optimizer；本轮无适合DS外发的新任务。

本轮已完成单例补正。独立GPT两项P3（错误码遗漏及前置失败错误退出0）已最小修复，新增反例后52/52定向mock与局部lint通过；最终VERIFY PASS，审计员另以Node24.19运行7项修复mock通过，无剩余confirmed finding。首次3项测试失败仅为JSON省略undefined字段的比较问题，修正测试序列化后通过，原fixture未改。正式账本再次只读核对仍0次/0占用；最终离线manifest已保存，真实HTTP0。具体命令/证据和新旧测试边界见报告2026-10-12节。

真实执行仍需账户可用额度、费用上界与安全Key输入；旧合成消费授权保留，无须重问预算。当前不传真实行情、不上传、不合并、不部署；既有Sites v32保持原状。本段为当前续接状态，下方2026-10-08交接为历史记录。

2026-10-08，承接3.0A，不重建Foundation。阶段：离线实现/验证与独立审计完成；真实合成试点已获准，Key待用户安全配置，任务保持开放。[本轮报告与运行手册](../docs/AI_PROVIDER_PILOT.md)。

## 基线与边界

GitHub PR#5在2026-10-08 08:38:33 UTC合并；main `7d2d30f6fe466a4e746ade2b3db231b2cb13b2d4`，tree `5bb8c8286636206df36bbd5d2349317a1445d26a`。main CI37751192029 success重新核对。独立worktrees/ai30b、codex/mr-30b-real-provider-pilot；起点干净。旧分钟工作树不修改。生产记录仍Sites v32/source4a4b7fb，未新部署；历史418测试不计本轮新测。

用户补充覆盖原模型/$5预算：gpt-6-luna、Standard、none、并发1、重试0、无工具。UTC自然月项目总预算$8，dispatch≤$7，试点≤20请求且≤$0.25。所有调用者/环境共用项目根data/local/ai-product-budget.sqlite；不以scope或进程分账。此前产品真实调用0；开发DS/Codex等费用单列。

用户本轮明确答复“允许合成试点，稍后安全配置 Key”。仅自有合成资料外发和该上限消费；不包括真实行情、充值、生产配置或发布。本机process/user OPENAI_API_KEY存在性均false；不读/输出密钥。未获Key时真实调用NOT RUN。

## 最小差异与契约

|Foundation差异|本轮最小实现|
|---|---|
|fixture-only Provider/usage/result|保留旧路径；新增固定OpenAI Responses适配及独立real-pilot结果契约；requested/returned model、response id、真实usage、未知费用分开|
|单证据claimFor|保留v1；v2只支持可枚举事实绑定、跨窗口/方向与RMS关系的受限句子综合；不接受自由金融断言。mandatory限制由服务端完整展示；质量收益单独评估|
|内存FixtureBudget|新增Node SQLite持久原子预留，完整请求/schema/output最大费用，未知不退回；账本不存在/损坏/不可写时fail closed，显式初始化；并发跨进程1|
|浏览器Context无信任|不升权浏览器事实；受控snapshot registry绑定scope/symbol/版本/有效期，按每字段用途剔除。真实来源推理/展示权利未批准，B真实输入BLOCKED，准备最小接入契约，不偷偷发市场数据|

## 模型及成本

官方2026-10-08核查：[Luna](https://developers.openai.com/api/docs/models/gpt-6-luna)、[价格](https://developers.openai.com/api/docs/pricing)：短上下文Standard input $0.10/M、cached $0.01/M、cache write $0.125/M、output $0.50/M；Responses/Structured Outputs/none支持。账号可用性未验证。固定全球endpoint，不区域premium；保守按全部input cache-write价，不假定命中。额外账单/税费未知，首次执行前须有账户可用的费用上界；预留倍率至少2，不能把估算当实际账单。完整序列化payload≤32KiB，输入tokens保守按UTF-8 bytes+2048包装余量，maxoutput2048，response≤64KiB，30秒，缓存16/60秒，无自动续写。

## 切片与允许路径

A：lib/ai/{real-config,real-output,openai-provider,real-service,snapshot}.ts，lib/ai/product-budget.mjs，scripts/ai30b-pilot.mjs，tests/ai30b-*.test.mjs。不改金融分类、旧v1校验、刷新与访问门禁。不新增依赖。账本与结果在忽略的data/local/outputs保存，不提交凭据/原始真实行情。

B：lib/ai/snapshot.ts实现最低受控snapshot/用途契约；loader候选复用lib/market-data.ts的getQuote/getHistory与既有缓存/在途去重，未配置真实loader或权限。现有State函数复用，不复制金融数学、不为未知许可执行真实请求。A质量和真实字段许可满足后才接当前市场案例；没有条件不扩fixture。

C：沿用现有解释UI与共享Hook，必要模式/预算失败说明；真实试点由本地受控CLI触发，不给公开网站真实API入口。无Key网站原行情正常、fixture原路径保留。

验证补充允许tests/browser/radar.mjs：复用既有loopback入口，RADAR_AI30B=1仅添加两种预算错误态，不改变本地harness的生产禁用保护。文档：tasks/ACTIVE.md（协调者单写）、docs/{CURRENT_STATE,AI_FOUNDATION,AI_PROVIDER_PILOT}.md及本卡。新UI只有实际新增能力所需时才接，不先造真实解释空壳。

## 验证与停止

先专项mock Responses/严格schema/错误usage/拒绝/incomplete/断流，负向证据与单位/窗口/数字/冲突遗漏，未知权限与snapshot失效，账本并发/跨进程/月切换/腐坏/失败预留/重复结算。合成场景沿用10类，固定fingerprint/预期/禁止结论；stale可正确拒绝而不凑请求。

稳定后全量Node、build/typecheck、受影响lint；沿用五视口harness检查原解释/未配置/预算说明、键盘与动效。没有新UI则不虚构新增真实模式通过。远端候选CI/真机/生产NOT RUN，无上传授权。无性能瓶颈跳过Optimizer。实际付费前定点独立GPT审查预算/语义/外发；最终稳定diff独立审计与FIX/VERIFY。DS可承担仅合成契约普通测试盘点，外发只限获准低风险内容；实际调用另记。

第一实际请求须先核Key、费用/账号边界，跑一个合成场景记录响应/usage/预留与校验；通过才继续冻结10类，关键语义错误暂停，最多一次依据明确的修正，仍计原预算。无Key则完整代码/离线证据交接，真实合成质量NOT RUN；B权限/实际当前解释BLOCKED；生产关闭。不得push/merge/tag/deploy、修改密钥、历史采购/采集或扩模型。

## 实际交接（不关闭真实阶段）

31/31专项、449项全量（448PASS/0FAIL/1既有Windows权限SKIP）、最终build/typecheck、受影响lint及五视口8组均为本轮新测。浏览器pageerror为空，两条预期429 console错误如实保留。没有完整npm test包装命令、新候选CI、生产或真机结果。主chunk825987bytes，对照825848为历史证据，无实测性能瓶颈，不进入Optimizer改动。

独立GPT两项P2（不匹配模型按低价结算、snapshot基准时效）已修并VERIFIED PASS；P3浏览器条件按钮选择器仅修测试，8组最终通过。最后18文件SHA/完整diff/报告证据只读复核VERIFIED PASS，无新增confirmed finding；最后复核未重跑全套或浏览器，也未验证真实模型/生产。DS一次外发审批拒绝后用户明确批准具体文字，再实际调用deepseek-flash一次/报告3013tokens，仅测试草案；GPT拒绝未知费用取消后退款建议，没有外发代码/行情。

产品API请求0、当月/试点已结算及未知预留0；单一项目账本位于project-root/data/local，显式初始化已完成，普通启动不重置。十类合成manifest已冻结，真实质量NOT RUN。默认真实来源rights为空，snapshot loader未接入；B真实输入BLOCKED。C保持既有fixture/未配置路径，真实Provider结果尚未接公开UI。待Key安全配置与费用/账号核验后执行已有授权合成试点；未获准真实市场外发或发布。
