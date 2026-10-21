# MR-30-AI-PRODUCTION-DELIVERY

2026-10-21；Market Radar 3.0 — AI Market Interpretation。状态：B1/C0/B2隔离准备已验证，确认的审计问题已修复并独立VERIFY；真实用途/生产接线与决定未完，总任务仍开放。

## 承接与边界

承接[3.0B主卡](MR-30B-REAL-PROVIDER-PILOT.md)、[真实Context子卡](MR-30B-REAL-CONTEXT-PILOT.md)及[已有报告](../docs/AI_PROVIDER_PILOT.md)。工作树worktrees/ai30b，HEAD cd902372c3c14b67d5b16b668b28849bbfd84231，分支codex/mr-30b-real-provider-pilot；23个已存在修改/未跟踪文件完整保留。远端main/PR/CI、生产绑定和原询问线程已只读核对，详见下文。旧507/584项是历史执行证据，Sitesv32部署状态本轮新核对；没有生产登录后实测。

用户本次将条件满足后的上传、PR正常合并、Sites部署及上线验收纳入总任务；旧卡禁止发布仅代表旧阶段。此任务不自动授权未确定真实资料外发、生产消费政策、付费资源、生产账本迁移或秘密配置。只阻塞相应动作，不阻止无外发的实现和验证。无新State/研究模型、模型路由、交易或分钟历史采集。

## Planner本轮工作

1. 核对当前候选及本地成果；读取原询问线程；新发信须另有具体授权，下文记录本轮已获准的发送。
2. 当前Sites工具只读核对运行时、绑定、秘密名称/存在性、发布版本；不打印秘密值。
3. 冻结一种权威持久方案后才实现，不并建DO/D1/独立服务。D1预留必须有数据库内原子条件，不采用先SELECT后INSERT。
4. 一张发布决定表集中明确首发身份/用途、用户/管理授权、预览和上线验收额度、正常生产消费、资源/账本切换与发布条件。

## 首发候选（不是已获准白名单）

优先BTC-USDT及ETH-USDT、OKX SPOT、USDT、UTC原生15m，Short90/Medium180 Direction/RMS及可证实的关系/限制。沿用现有公式、窗口和数据有效性。OKX用途仍需本轮来源依据；Coin Metrics只作为已联系的有限替代，不以USD参考价冒充USDT K线。最终冻结前不声称两资产已支持，不静默缩减成单资产演示。

## 接口与实施切片

A：平台/用途/发布决定。B：原预算语义的目标运行时适配、原子预留和不可重放派发状态、停用/迁移演练。C：实际会话身份、最小AI授权、受控snapshot与原编号服务/DTO接线。D：共享UI、真实案例、运行时/浏览器/独立审计。E：满足授权及验收后原PR→CI→正常合并→Sites部署→上线真实验证与关闭演练。

先只读并行盘点预算兼容和Worker鉴权/集成，协调者单写ACTIVE。Agent不碰Key、正式账本、真实行情或外部模型；产品写入Agent须独立worktree。GPT负责核心决策；开发DS没有本次具体载荷授权，暂不调用。

## 允许路径与验证

规划允许本卡、ACTIVE、现有CURRENT_STATE/API_CONTRACTS/AI_PROVIDER_PILOT及忽略outputs/ai30-production。产品允许路径在平台和接口定稿后明确，不提前修改配置/迁移/生产策略。

后续验证：受影响Node→目标Worker等效运行时（持久、并发、重启、幂等、跨月、未知费用、迁移/关闭）→稳定全量/typecheck/build/相关lint→既有五视口/组合负载→独立GPT审计/FIX/VERIFY。真实资料、费用、生产、远端CI与mock分开。源码不变时不重复旧全量检查。

## 停止条件与下一动作

### 2026-10-21 已核查与B切片定稿

GitHub PR#6仍open/Draft，head cd90237、base main7d2d30f；该head CI39228845333 success。Sites当前owner权限/public观众，最新v32/source4a4b7fb、deployment appgdep_6ac10cdc5044819187b34baa7345f0b3 succeeded、环境revision3。实际read_database_overview返回bindings=[]；不是根据Env类型推定。生产环境仅现有门禁/monitor变量，无产品DeepSeek Key。秘密值未打印/复制。询问线程仅原SENT；相关主题备用邮箱搜索遇RATE_LIMIT_EXCEEDED，不重试绕过，无法排除另起线程回复。

平台技能1.1.0明确支持声明D1并由Sites托管，无已确认DO配置入口。因此冻结唯一实现候选：现有Worker + D1权威，不并建DO/独立云服务；实际资源尚未开通。Cloudflare公开D1价仅作参考（Free日读5M/写100k、5GB；Paid超量读$0.001/M、写$1/M、存储$0.75/GB月），Sites实际计费及资源授权仍待确认，不推定免费。正常生产消费、真实外发、资源迁入/秘密配置待集中决定。

先实施可独立验证B1，不接付费入口、不改hosting绑定：新D1预算存储适配、schema与隔离Worker等效测试。所有隔离测试显式mock/本地Miniflare D1，禁止remote、真实Key或正式库。允许路径lib/ai/d1-budget.ts、db/ai-production-budget.sql、tests/ai30-production-budget.test.mjs及专用fixtures；暂不挂发布迁移或更改旧ProductBudget/real-service，防止半成品变成可消费入口。独立worktree production-budget基于cd90237；在此实现后协调者接收新文件。

契约：旧requests/profile字段、纳美元单位、费率依据和原pilot键保持；新的固定project authority/control、消费政策和dispatch意图单独表。默认disabled且无可信导入/政策不派发。reserve预算判断在首条条件写入SQL内部，后续profile/request/intent在同一D1 batch事务；幂等键绑定scope、固定payload与profile，同键不同payload拒绝。全项目仅一个reserved；intent由ready条件claim至dispatch_started并提交后才允许HTTP，重复claim/崩溃不重放。unknown保留全部预留；恢复并发与退款分开，跨月仍保留未决额保守占用，原月结算不改历史费率。settlement按原profile验usage/金额、重复结算幂等、错误差异拒绝。总开关在reserve与claim分别检查，停止不阻止必要结算。新生产政策默认关闭，验收仍原总20/$0.25及UTC月8/派发7；不能由客户端切production绕过。

迁入B2稍后按只读一致备份与逐行校验明确，不在B1创建“已迁入”声明；B1仅隔离fixture初始化，无真实资源写入。最小账户授权/持久snapshot/UI等C/D依赖B接口，先不重复实现。B1专项验收须真实workerd本地D1验证并发最后额度、双键/同键、跨重启、停用/claim、unknown/跨月、费率/金额/失败回滚；之后独立GPT审查。若纯存储接口尚不连产品，明确未交付真实解释，不以此关闭总任务。

C0可与B1并行的根协调者独占路径：worker/ai-authorization.ts、tests/ai30-production-auth.test.mjs。只做服务器权限边界，不挂公开路由/新按钮、不改网站共享访问码。平台可信user-id来自Sites请求身份，server-side grant按固定站点和subject读取；请求体/查询scope、role不参与。invoke/read/manage分别授权；scope绑定站点/subject/授权revision，撤销/到期/禁用实时重查，不用旧缓存续权。POST要求精确同源、JSON、有限字节；固定受支持资产集合来自服务器配置，无客户端任意参数。生产来源和白名单未批准时配置为空，全部拒绝；测试只用明确fixture授予。目标Worker中验证原生crypto/Request/Response及身份拒绝，实际公网身份头防伪仍待部署前后验证。

### B2隔离迁入演练契约（不是实际迁入授权）

2026-10-21只读打开原权威库，query_only/quick_check通过，v2/倍率2，2026-10共11 settled且全DeepSeek，原pilot占用34457400nano、基础usage17228700nano，reserved/unknown0；读前后文件大小32768与mtime不变。未读取Key或原回复。未以构造ProductBudget自动改schema。

B2仅新增lib/ai/budget-migration.mjs、tests/ai30-production-migration.test.mjs和必要的专用fixture，不向真实CLI挂迁移命令、不给正式路径默认值、不修改B1四文件。独立worktree实施。已知v2/双profile、固定项目和原pilot、倍率2；最多64行/256KiB的单次初始交接（当前真实11行，只是容量依据，测试用合成记录）；所有月份逐行保留。未知schema/可选real_context扩展暂拒绝，不丢表或改名。reserved拒绝退役，unknown全额保留。SQLite BEGIN IMMEDIATE下冻结内容hash并写不可撤销退役记录/SQL触发器，阻止已打开旧进程的写入；失败不能复活旧派发。退休后可安全重导，不把JSON里的retired当授权。

B2独立审计P2后补定目标契约：显式、隔离provision在空disabled/pending目标生成不可变随机instance UUID；目标能力同时绑定实际db对象与持久UUID，源retirement/hash含该UUID。import不初始化，首个条件写入与verified必须核对数据库内UUID；同label的另一库拒绝，同实例重启重新打开受控凭据可接续。禁止用字符串targetId独自代表数据库身份。UUID/本地capability仍不是云端resource ID证明，实际绑定与克隆恢复的消费授权需部署工具另核对，不能因导入verified自动启用。

受控迁移函数只接受同进程从已退役源生成的导出凭据，并核对固定目标身份。目标必须disabled/pending且空；原子批次导入profile→requests→metadata/receipt（有界分组参数，单语句≤100绑定），无历史ready intent、无policy、不开enabled。读回逐字段/摘要/月份和pilot合计核对；完成前不授予调用能力。若B1结算接口可能在待核验阶段改动行，须通过导入锁或原子核验解决，不依赖“没有人调用”。同receipt重跑检查原行且不重复、不同目标/摘要/已有无关记录拒绝，不清库。旧源永久只读，新权威也默认关闭；实际切换另等批准。

测试：双provider/跨月/unknown、原行与费率、旧已开句柄禁止reserve/settle、reserved阻塞、扩展/损坏/缺profile拒绝；请求后/写入中/提交回应丢失安全恢复；重复导入及错目标；关闭重开；停旧失败时目标不启用；零真实网络。源一致备份在隔离文件目标采用SQLite VACUUM INTO或已证明一致方法，不能在线复制主文件冒充备份。B2独立审计后才形成真实迁入候选，正式迁移/云资源仍未执行。

### 发布决定表（缺项不默认为同意）

| 决定 | 本轮已知/推荐 | 状态及精确边界 |
| --- | --- | --- |
| 首发资产/字段 | BTC/ETH具体现货市场、原生15m、Short90/Medium180 Direction/RMS/证据/限制 | 尚无满足此产品AI用途的批准来源；实际白名单为空，不改现有金融阈值 |
| 来源用途 | 获取/计算、DeepSeek派生事实推理、站内衍生展示、≤30日私有证据保存分别核对 | OKX既有评估限制未解除；Coin Metrics官方答复待取得，不用技术访问代替许可 |
| 用户真实外发 | 来源确定后明确market/source/字段/接收方/保存及验收次数 | 旧合成及本次邮件授权均不包括真实行情外发；不提前派发 |
| 首发用户 | 推荐仅站主，平台稳定user-id绑定服务端grant；invoke/read/manage分离 | 实际站主身份尚未安全取得/授予；共享访问码不升权。正常网站观众设置不变 |
| 模型 | DeepSeek官方/deepseek-flash/none/无工具/不重试/不回退 | 10月21官方价格仍输入高峰未缓存$0.30/M、输出$1.20/M；不改变历史profile。生产无专用Key，当前账户余额未新查 |
| 验收预算 | 建议最多6次：预发布两资产2次、上线后2次、必要修复复测最多2次 | 只是拟议，未批准启用；仍计入原20次/$0.25（实际剩9次/$0.2155426）。按现有32768字节输入上界+2048包装预留+2048输出、原2倍费用边界，每次最大预留$0.0258048，6次最多$0.1548288；不是账单/必须消费量，每例有审阅停点 |
| 正常生产消费 | 推荐站主手动、并发1、UTC每日最多3次，仍UTC月$8/派发$7 | 超出验收20次的正常生产政策尚未批准/实现；不重新申请已确认月预算，不放开客户端policy |
| 唯一存储 | 当前Worker+D1；原本机预算冻结迁入后旧CLI禁止消费 | 实际Site无D1；B1/B2只隔离实现。新资源费用/开通与正式迁入尚未授权，不创建真实库。Cloudflare公开价不等于Sites账单 |
| 秘密/发布 | 原PR正常CI/合并、原Site部署与上线验证是本任务条件满足后的步骤 | 生产秘密配置/实际身份授予等具体操作仍待集中批准；不以旧卡禁发布阻止后续，但不跳过当前Gate |

2026-10-21 15:06 UTC，用户明确批准新的生产用途补充询问，已通过连接邮箱发往此前核实官方Community支持；工具确认SENT（私有回执outputs/ai30-production/source-inquiry-send.json）。精确稿outputs/ai30-production/coinmetrics-production-scope-inquiry.txt，询问BTC/ETH窗口、派生推理、30日私有保留及站主网站展示，未含代码/数据/账本/Key，没有订阅/试用申请。旧询问仅私有三次，即使获答也不自动覆盖新生产用途。未启用自动跟踪/催询。发信授权不等于来源许可或真实外发许可。

发现来源许可、真实外发、资源或迁入授权缺口仅暂停相应外部动作。B1/C0/B2离线成果需审计复核后交接；真实入口/UI/案例及生产切换尚未完成，不以本地存储准备关闭总任务。

## 本轮交接：隔离准备完成，总任务开放

已接收9个新产品/schema/测试文件，未改动前轮18个Real Context产品/测试文件（与原final-files.json逐项SHA256一致）。本轮代码没有接入生产路由、真实Provider或公开UI；原权威账本仅只读核对，没有退役/迁入，原调用数量和占用未变。

- B1：D1原子预算、停用、claim一次性与unknown保留；独立审计发现损坏金额可能被SUM忽略的P2，已通过数值约束及原子完整性检查修复，独立38项VERIFY。补测无active请求时的损坏账本拒绝，主树最终预算39项通过。
- C0：服务端grant、受控命令、同源边界、撤销与跨身份拒绝，6项通过，独立GPT只读审计/VERIFY无finding。未验证Sites真实边缘身份头防伪或授予真实用户权限。
- B2：一致备份、旧库不可撤销停写、保留旧profile/占用、目标关闭/逐行读回/中断恢复；独立P2目标同名可换库已修为不可变实例UUID+绑定凭据，独立32项VERIFY。结构疑点已复核撤回：本轮入口先用固定完整B1 SQL初始化隔离库；迁入verified只认证这条限定路径，不认证任意已有数据库结构。

最终主树全量661项：660 PASS、0 FAIL、1既有Windows文件symlink权限SKIP；新三文件套件合计77项通过。专项初跑唯一鉴权测试被esbuild父目录沙箱访问阻断；获自动审批后同文件6/6及最终全量均通过，无产品修补掩盖失败。构建/typecheck本轮通过；最终相关lint/diff检查通过。构建后只改未接入bundle的Node迁入模块及测试，最终全量覆盖该固定修复。没有运行npm test包装；实际Windows分项命令/日志见报告。

本地日志与最终hash位于忽略的outputs/ai30-production；不提交账本、原始Provider资料或Key。远端CI仍是cd90237历史候选，本轮diff没有新CI、push或commit。当前Sitesv32仍正常部署，本轮未重新发布/配置秘密/启用模型。

仍未验证/交付：实际来源和具体真实外发准入、生产grant与持久snapshot/共享UI接线、正常生产政策、云D1完整schema/资源身份/配额、实际迁入与站主身份注入、真实页面案例/关闭演练。64行是本地输入上限，未实测64行成功迁入；初次导入24+2N语句，远端执行上限未确认，不能据本地通过直接生产执行。真实/已有库接入前必须另作结构与资源预检，并按Sites Drizzle迁移流程审查。本轮五视口/真机/线上与UI性能NOT RUN：没有新增UI接线，旧证据不替代未来生产界面验收。

下一步先取得来源生产用途答复；据明确资产/字段与实际资源收敛一次具体发布决定，再完成剩余接线和真实验收。没有自动邮件追踪、常驻任务或继续消费；不归档本总任务为完成。
