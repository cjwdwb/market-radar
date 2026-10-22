# Market Radar 3.0B — 受控 Provider 试点交接

2026-10-22正式发布：**Radar本机历史事件 + AI准备 / Sites v33**，源码`6f7e1e889e5b714bd3f26ffd560126bd5ea01cbe`。PR#7正常合并，远端build/typecheck及678/678 Node通过，独立审计/FIX/VERIFY与包装审计通过；平台succeeded、env revision3，原网址 https://market-radar-rex.swt-aether.chatgpt.site 。本机7天/120条历史记录、筛选、原证据与当前图表返回已上线，真实AI仍关闭。未开云资源/迁移/调度或修改秘密和访问策略；生产登录后/真机未测。[发布记录](../tasks/archive/MR-PUBLISH-AI30-PREPARATION.md)、[历史事件验收](../tasks/archive/MR-RADAR-EVENT-HISTORY.md)。主3.0真实交付及数据track仍开放，下面是历史时点。后续文档提交不等于生产重新部署。

2026-10-21 后续发布授权：用户明确“上传部署吧”，执行[发布卡](../tasks/archive/MR-PUBLISH-AI30-PREPARATION.md)。范围为当前验证候选在真实AI关闭状态下的上传部署；不改变下文来源/真实外发/生产消费的缺口。GitHub、Sites与发布新测结果集中记录在该卡，下面保留开发阶段原始结论。

## 2026-10-21 AI Market Interpretation：生产准备切片（总交付仍开放）

[MR-30-AI-PRODUCTION-DELIVERY](../tasks/MR-30-AI-PRODUCTION-DELIVERY.md)承接原候选与全部未提交Real Context成果，不重做Foundation、不删除旧失败。主工作树HEAD仍`cd902372c3c14b67d5b16b668b28849bbfd84231`；本轮只读核对PR#6为open/Draft，main/base为`7d2d30f6fe466a4e746ade2b3db231b2cb13b2d4`，旧候选CI39228845333 success。该CI没有覆盖本次未提交改动。

**现有生产已上线；本轮未重新发布。** Sites工具新核对v32/source`4a4b7fb66ac4fc10663087b42a09e08c55804e2a`及原部署succeeded；当前部署者owner、观众public、环境revision3。实际数据库overview返回无绑定/无表；环境只检查变量名称，无产品DeepSeek Key。没有生产登录后测试，没有开通资源或配置秘密。

### 来源与发布决定

首发仍以BTC/ETH的完整现货身份、原生15m与已有Direction/RMS为候选；实际批准资产白名单为空。旧OKX评估用途限制没有被新任务自动解除。10月19日Coin Metrics原询问线程本轮读回仅SENT；备用主题搜索遇工具RATE_LIMIT_EXCEEDED而停止，不能排除另起线程答复。旧问题只覆盖私有三次，不自动覆盖生产。

用户本轮明确批准后，2026-10-21 15:06 UTC向已核实官方Community支持发送新的生产用途补充询问，工具确认SENT。询问具体BTC/ETH窗口、DeepSeek最小派生事实推理、≤30日私有证据保存及站主网站展示；无代码/行情/账本/Key，不申请订阅、试用或采购。具体稿/回执在忽略的`outputs/ai30-production/`，无自动邮件跟踪。来源答复和用户真实数据外发许可仍未取得；发送询问不解除这些Gate。

冻结唯一平台候选为现有Worker+D1，不另建DO/独立服务器。Sites 1.1.0存储文档支持D1声明/托管；实际资源尚未开通。[Cloudflare官方D1价](https://developers.cloudflare.com/d1/platform/pricing/)只作容量/费用参考，不作为本Site已免费获配额或获准付费的证明。站主身份授予、正常生产消费政策、D1实际资源/迁入、生产专用秘密须在任务卡决定表中按具体范围批准。已有UTC月$8/$7派发/$1缓冲不重复申请。

### 本轮独立准备的边界

- B1：新增D1预算适配及隔离schema。条件写入与预留同一事务，幂等键绑定scope/固定快照与目录/profile摘要；claim提交成功仅一次才允许后续派发。未知费用不退款，旧月未决保守带入，失败停批与结算同事务。只保存财务及hash元数据，不保存完整行情/Provider payload。默认disabled、pending；不产生生产策略、不挂hosting迁移、不接真实Provider。
- C0：新增Sites身份+服务端grant边界。invoke/read/manage分离，访问码/email不授予付费权限；固定站点/Origin、受限操作JSON、每次重新查授权、撤销/revision/到期及跨用户快照拒绝。没有接入公开路由；本地workerd中的合成Request仅证明原生API兼容，不能证明真实Sites边缘头防伪。
- B2：按任务卡的64行/256KiB已知v2输入边界，在隔离SQLite/D1完成冻结旧库、逐行迁入、一致备份与恢复。SQL触发器阻止旧已开句柄继续消费，目标无policy且始终关闭；真实11行账本未退役/迁入。目标凭据绑定不可变实例UUID，原库重启可续接，同label第二库拒绝；未知schema/real_context扩展拒绝而不丢表。仅测试规定结构的隔离新库，云资源/结构/配额尚未验证。

原权威库本轮以SQLite readOnly/query_only核对，quick_check=ok：11/20次，保守占用$0.0344574，基础usage估算$0.0172287，reserved/unknown均0；均属2026-10/DeepSeek。读前后文件大小32768字节及mtime一致。剩原试点9次/$0.2155426、月派发余额$6.9655426是此次账本快照，不代表供应商余额。实际供应商账单未取得。无新模型请求、无真实市场资料外发；未读取或复制专用Key。

### 验证与限制登记

Windows / Node22.15.0；本地Miniflare/workerd；数据/身份/财务演练均显式fixture，测试无真实外连。首轮集成专项167/167通过，日志`outputs/ai30-production/targeted-tests.txt`；这早于后述预算完整性修复，不能作为修后唯一依据。独立GPT C0只读审计/VERIFY无finding；6/6由协调者新测，TS/局部lint通过。构建与项目typecheck本轮新执行通过，分别`build.txt`、`typecheck.txt`；Windows实际分项命令，不声称运行npm test包装。

独立GPT对B1发现P2：非STRICT SQLite可接受文本金额，SUM将损坏unknown占用当零。Builder增加schema数值类型/安全范围与原子SQL完整性守卫，独立实际workerd 38/38 VERIFY；根代理另补“没有active请求”的首次reserve拒绝反例，最终预算39/39通过。B2独立P2：同label可以误接第二数据库；修复绑定持久实例UUID，独立32/32 VERIFY。两个确认问题均关闭。完整目标DDL疑点经独立复核撤回：本轮入口先以固定B1 SQL初始化隔离新库；不代表迁入模块已认证任意已有数据库。正式云库还需完整结构/资源身份预检，不以verified自动授权消费。

最终主树新测 **661项：660 PASS / 0 FAIL / 1 SKIP**，其中B1/C0/B2为39+6+32=77项通过。唯一SKIP为既有Windows文件symlink权限不足（junction另有覆盖）。专项初跑出现1次esbuild父目录沙箱访问拒绝；同鉴权文件经自动审批后6/6通过，最终全量也通过，未弱化断言。受影响lint/diff检查通过。构建和typecheck在本轮先前稳定候选执行成功，后续只修改未接入bundle的Node迁入模块/测试，最终全量覆盖修复；不声称重跑未执行的包装命令。

| 本轮验证 | 实际命令/对象 | 结果与证据 |
| --- | --- | --- |
| 完整Node | 固定Node22.15，`--experimental-strip-types --import ./tests/register-types.mjs --test` + rg取得的全部顶层test文件 | PASS（660通过/1既有skip），`final-full-node.txt` |
| build | 同Node执行`node_modules/vinext/dist/cli.js build` | PASS，`build.txt`；仍有既有500KB chunk及实验功能警告，未据此称性能通过 |
| typecheck | 同Node执行`scripts/typecheck.mjs`，使用实际生成类型 | PASS，`typecheck.txt` |
| 相关lint | 同Node执行eslint，对新8个JS/TS文件 | PASS，`final-lint.txt` |
| 独立审计 | GPT对固定B1/C0/B2 diff，确认问题FIX/VERIFY | PASS（限定隔离范围）；B1新增无active用例独立静态复核、协调者执行 |
| 远端CI | PR#6/cd90237旧CI39228845333 | 本轮diff NOT RUN，不借旧CI作新结果 |
| 浏览器/性能/真机/生产 | 本轮没有新增UI或真实Provider接线 | NOT RUN；不复用旧五视口作为生产验收 |

以上日志、审批后重测、最终hash清单均在忽略的`outputs/ai30-production/`。前轮18个Real Context产品/测试文件SHA256未变。所有财务演练均合成，本轮真实API调用0、财务占用新增0；实际供应商账单仍未取得。

迁入局限：未执行64行成功边界；初次导入24+2N语句，64行对应152条，本地输入上限不证明远程D1可在配额内完成。未来真正云接线需按实际Sites资源核对配额与schema，走既有Drizzle/托管迁移流程；本轮SQL只是隔离候选，不是已发布迁移。

尚未交付：真实来源准入、生产消费政策/授权与持久快照接线、实际页面真实案例、正式迁入、上线与上线关闭演练。无新UI路径接入，因此本轮未重复五视口/真机；10月19日私有五视口是历史证据，不替代未来生产UI。无实测性能瓶颈，不启动Optimizer；未声称FPS/模型增益。开发DS未调用（本轮为GPT核心鉴权/存储审查），产品DeepSeek新增调用0。下文原3.0B记录保留。

## 2026-10-19 Real Context 私有准备（当前未发布候选）

任务[MR-30B-REAL-CONTEXT-PILOT](../tasks/MR-30B-REAL-CONTEXT-PILOT.md)接续`cd902372c3c14b67d5b16b668b28849bbfd84231`，不是重启3.0B。该HEAD/PR#6 Draft未合并，旧CI39228845333 success本轮只读核对；main为`7d2d30f6fe466a4e746ade2b3db231b2cb13b2d4`。当前代码为本地未提交diff，旧507项不作为新路径验证。生产仅沿用Sitesv32/source`4a4b7fb66ac4fc10663087b42a09e08c55804e2a`记录，本轮无生产配置或模型启用。

### 用途决定与具体缺口

唯一技术候选：BTC-USDT / OKX SPOT / USDT / UTC / native15m，Short90及Medium180 Direction/RMS。2026-10-19读取[官方API Agreement](https://www.okx.com/help/okx-api-agreement)（更新2026-07-28）：一般AI整合§3.4仍受§9.4约束；§9.4(c)限制行情用于评估拟向第三方提供的AI系统。Market Radar本轮是产品解释质量对照，没有适用例外，因此不是已获准的私人交易工具用法。

| 用途 | 决定 | 范围/证据/下一步 |
| --- | --- | --- |
| 为此次产品AI评估取得资料及内部计算 | DENIED | §9.4(c)，不因此改动现有非AI行情链路；需来源方适用许可/例外 |
| 派生Direction/RMS事实发送DeepSeek | DENIED | 标签仍依赖该行情，不能改名/删source绕过；同一评估限制 |
| 最小输入、回复、校验证据本机30日保存 | UNKNOWN | 仅为方案；未取得可覆盖此用途的依据，当前没有真实capture |
| 本人loopback私有衍生预览 | UNKNOWN | 不把非商业/有访问码当全面许可 |
| 原始行情向第三方公开展示 | DENIED | §9.4(a)，本轮不要求公开原始数据权，不以此替代AI评估核查 |
| 用户对真实市场资料具体外发 | 未授权 | 旧合成授权不涵盖；来源许可可行后一次确认具体字段、接收方、30日保存、最多3次 |

Yahoo只定向核查一个既有替代：技术可用不等于用途批准，官方条款正文返回999，未绕过；Coin Metrics现有日频不满足分钟State。未调查更多源或采集分钟历史。真正解除动作是取得覆盖当前产品AI评估/第三方推理/最小私人保存展示的来源依据，再取得用户具体外发同意；不是再次确认免费非商业，也不是再次申请原月预算。

### 必要离线接线与运行边界

后续只读推进（同日）：[Community官方说明](https://gitbook-docs.coinmetrics.io/packages/coin-metrics-community-data)中的7点限制属于细粒度参考价，不宜推广至market-candles；[ReferenceRate原生周期](https://gitbook-docs.coinmetrics.io/coin-metrics-prices/coin-metrics-prices/reference-rate-metrics)也不含15m。既有coinbase market-candles 403仍是旧探针记录，本次未请求行情。共享准备至少22个连续完整点，USD综合参考价和USDT现货K线的身份/时间契约不同，不能配置换名。当前免费替代尚未满足技术准入，未更改来源许可。

现有cm-labs入口现跳转[官方Coin Metrics/Talos页](https://www.talos.com/our-solutions/data/overview)，其Community Support列明datasupport@talostrading.com。已将一个BTC现货市场、当前22–96根原生15m、最多3次DeepSeek私有评估及30日本机最小保存的具体问题写成可审阅本地询问稿；另备OKX客服稿，待转API许可团队。`outputs/ai30b/real-context/coinmetrics-source-inquiry.txt`与`okx-source-inquiry.txt`在准备时均未发送，不含代码、真实输入或秘密，也不授权购买。外部发信仍需明确授权；来源答复必须同时覆盖实际数据能力与用途，不把“能请求”当许可。真实输入外发另按本任务确认单，不沿用旧合成同意。

用户随后明确允许发送上述具体Coin Metrics询问，2026-10-19 11:12 UTC由已连接邮箱发送，工具返回SENT，无附件；私有回执`outputs/ai30b/real-context/source-inquiry-send.json`。OKX稿未发送，来源答复尚未取得，技术/用途Gate未解除。发信授权不含真实资料外发，未启用自动跟踪、催询或采购。两稿经过独立GPT只读核对，任务卡一处窗口说明P3已修，不涉及State代码。

此后续只改说明/询问稿；18个产品/测试文件与已验证候选hash一致，diff格式检查通过。上述584项、五视口及源码审计是此前实施证据，本次未重跑产品测试、未重查远端CI、未打开正式账本/Key。产品请求仍0，生产无变化。

`real-context-policy`的`approvedRealContextGrant()`固定返回null，浏览器/env不能升权。loader复用单资产`getQuote(symbol,false)`与`getHistory(symbol,'15m')`，两项逻辑请求，正常为ticker+96根recent candles；已有两源有限回退及candles→history路径最坏6次HTTP尝试。当前实际调用0。原底层没有按等待者取消接口：取消本次等待、停止后续State/模型派发并丢弃晚到数据，不宣称取消共享网络。State门槛、freshness及行情刷新未改。

registry过滤后仅四个方向/RMS证据，明确其余维度not_included、分钟研究unsupported、长期位置not_computed。克隆/冻结Context及准入记录，绑定访问者/资产、来源/币种/周期、真实证据时间、数据hash、规则/策略/授权版本；get、派发、缓存与返回各自复核。服务端创建的WeakMap能力不接受克隆、客户端Context或trust字段。过期禁止新派发，已返回的合法原快照按原asOf说明，不追随当前行情；撤销则拒绝访问。

真实DTO为`private-interpretation-v1`，保留原fixture schema。只传有界事实、同目录固定模板A、模型编号顺序B、恢复与系统披露C；catalog/引用/来源/快照身份严格校验。Node/SQLite/运行时目录不入浏览器。`modelValue=UNPROVEN`固定，系统补齐不能记成模型能力。

`scripts/ai30b-private.mjs`代理现有页面，127.0.0.1绑定、20分钟技术会话、精确Host/Origin、独立随机内存凭据、POST JSON≤2KiB、固定BTC与路由、无通配CORS/公网隧道。原访问码门禁仍保留；只有经过私有Origin核验才向固定上游转换Origin，私有凭据不转发。API能力GET只披露gate，不提供资料。现有Hook共享结果，私有链路60秒截止，旧fixture6秒不变；原生滚动、切资产和手动周期不改变输入事实。

可在本机预览准备状态：先启动项目本地预览（仍需原网站访问验证），在安全终端设置独立随机`MARKET_RADAR_AI_PREVIEW_SESSION`，再执行`node --experimental-strip-types scripts/ai30b-private.mjs http://127.0.0.1:<预览端口>/ 5308`，访问`http://127.0.0.1:5308`并在页面会话输入框连接。凭据不放命令参数/URL/Git。默认只显示来源阻塞，**此CLI没有接通产品Key、正式账本或真实transport**；不能靠配置环境变量解除。停止终端或20分钟到期关闭本机服务。批准后的真实启动绑定、证据落盘/到期清理及实际页面点击仍待完成，不把注入mock工厂称为已消费真实模型。

### 预算、证据与分工

原ProductBudget添加显式批次扩展：固定`MR-30B-REAL-CONTEXT-001`，同原pilot键及reserve事务关联最多3次，重复授权启用不重置，授权不同/丢表/丢标记拒绝；失败或unknown与停批同事务，跨进程不能趁结算后窗口继续调用。旧provider价格、旧记录/金额不重算。仅临时库迁移和模拟11条历史兼容测试；**正式库本轮未打开、未迁移、未写入**。

真实市场取数0、真实Provider HTTP0、真实快照0、正式预留0、新增产品费用0。旧11/20次与$0.0344574为上轮报告，不是本轮重新确认余额；供应商账单仍未取得，执行前必须重查原库。没有将mock费用写入正式余额。拟保存30日的是未来获得许可后的最小证据，当前只在忽略`outputs/ai30b/real-context`保存模拟QA日志/截图，不含产品Key、Cookie、用户资料或受限capture。

GPT负责范围/源用途、核心实现及独立审计；两个GPT Builder在独立worktree处理预算/专项测试和UI/浏览器harness，协调者逐项接收。开发DS实际调用0、产品DeepSeek调用0；没有外发真实资料给开发Worker。原失败与9次合成结果保留，未新增重复合成付费评估。

### 本轮验证与审计交接

Windows / Node22.15.0 / Edge149.0.4022.98，生产等效本地workerd构建，测试时Worker外网请求拒绝；浏览器mock只在loopback和隔离浏览器上下文生效。所有新增测试使用显式transport、临时库及虚构行情，OKX身份标签只验证匹配契约，不是来源取数证据。

| 检查 | 本轮结果 | 可复查证据及限制 |
| --- | --- | --- |
| 全量Node | PASS，584项：583通过，1既有Windows文件symlink权限SKIP，0失败 | `outputs/ai30b/real-context/node-full.log`；新29项私有链路、29项批次、19项UI＋原回归。不是原507次重述 |
| build / typecheck | PASS | `build.log`、`typecheck.log`；用下述分项命令，未声称运行Windows的npm test包装 |
| 受影响lint | PASS（新核心/UI/测试/runner） | `lint-scoped.log`；主组件仅改一处链接文字，整文件仍有基线同样3 error/5 warning，已用原HEAD内容对照`lint-baseline-main.log`，未顺手重构 |
| 私有HTTP边界 | PASS，Node本地真实HTTP＋模拟runtime | 错Host/Origin/token/JSON/资产/参数均拒绝，原accessGate用合成秘密登录/登出，token不转发；不是生产鉴权或用户真实登录 |
| 私有页面五视口 | PASS，6组 | `browser/verification.json`及`ai-private-{desktop,tablet,mobile,narrow,landscape}.png`；1440×1000、768×1024、390×844、320×740、844×390，键盘、三档偏好、44px、无横溢、证据定位、失败保留、返回周线；所有私有HTTP在浏览器侧mock，不替代上述HTTP边界测试 |
| 原fixture页面五视口 | PASS，8组 | `browser-legacy/verification.json`；本轮在最终构建复测原Worker fixture、缓存、取消/换资产、预算失败与手动周线返回，0pageerror，2个预期429 console error |
| 交互并行 | PASS（隔离行为检查） | 模拟解释等待时刷新报价、真实画布拖动/缩放、滚动/导航、取消及快速换资产，旧BTC不覆盖NVDA |
| 浏览器告警 | 0 pageerror；5个预期503 console error | 故意触发失败保留场景所致；未写成无任何告警 |
| 真机/用户本人试用/生产登录后 | NOT RUN | 桌面视口不能替代iPhone；本轮无真实输入案例 |
| 远端CI | 本轮diff NOT RUN | PR仍Draft未推送；39228845333 success仅旧候选 |
| 独立GPT审计 | 修复后静态VERIFY，无剩余confirmed finding | 原始审计/复核与主代理执行测试分开；审计员未操作正式库/网络/Key |

审计修复范围：代理Origin未对齐导致登录失败；准入记录顶层可修改；DTO目录/来源未绑定；失败结算后再停批的跨进程窗口；证据写入期间过期/撤销的派发与结算检查；重连保留旧scope结果；组织失败误示网络问题；展开证据遗漏方法/取得时间。对应负向回归保留原阈值、引用与费用断言。集成另修DTO复合metricRefs上限（4证据×12项=48，实际13不能截断）及原冒号引用格式。预算独立审计发现的SQLite REPLACE绕过也已修复并验证。没有BLOCKER/HIGH遗留；真实用途阻塞属于未获准条件，不改写成产品测试PASS。

浏览器新链路点击到mock呈现约847–873ms，含人为300ms响应等待、固定时钟和浏览器操作开销，不是DeepSeek耗时或性能提升。当前client JS合计1,199,554字节/12文件；本轮未构建基线同条件bundle对照，不宣称减少。沿用原500kB chunk warning，无新增可复现瓶颈，Optimizer未进入；未测真机FPS/峰值内存，不作流畅度量化承诺。

实际命令（以本机已确认Node22入口运行）：

```text
node --experimental-strip-types --import ./tests/register-types.mjs --test tests/*.test.mjs
node node_modules/vinext/dist/cli.js build
node scripts/typecheck.mjs
node node_modules/eslint/bin/eslint.js <本轮核心/UI/测试/runner文件>
RADAR_SYNTHETIC_AUTH=1 RADAR_AI30B_PRIVATE=1 node tests/browser/radar.mjs
RADAR_SYNTHETIC_AUTH=1 RADAR_AI30_ONLY=1 RADAR_AI30B=1 node tests/browser/radar.mjs
```

最后一行为环境变量说明；实际Windows使用PowerShell `$env:...`，预览固定loopback5319，Playwright指向已安装运行时。首次本地预览遗漏Miniflare user-worker绑定导致500、浏览器等不到图表；仅修忽略目录测试启动器，未改产品构建或弱化测试。末次五视口来自修复后的最终UI构建。

| 阶段 | 当前判定 |
| --- | --- |
| REAL_INPUT_ADMISSION | BLOCKED：来源用途DENIED/UNKNOWN；具体真实外发授权未申请 |
| TRUSTED_SNAPSHOT | 离线接口/隔离验证PASS；真实来源capture NOT RUN |
| REAL_CURRENT_CASE | NOT RUN：0真实snapshot、0预留、0HTTP、0成功/失败/缓存样本 |
| PRIVATE_UI | 本地mock五视口PASS；真实页面点击、真实启动绑定、证据持久保存尚未完成 |
| MODEL_VALUE | UNPROVEN；同快照对照界面完成不等于模型有增益 |
| ENGINEERING_REVIEW | 当前受限准备可审阅，独立GPT静态VERIFY；不是生产准入 |
| PRODUCTION_ENABLEMENT | DISABLED；未push/合并/Ready/tag/deploy，现有Sitesv32不变 |

下一步只解决一个条件：取得该单资产来源对本产品AI评估及最小私人证据用途的许可依据；之后集中确认既定最多3次真实外发，再接原账本与专用Key进行首个页面手动案例。当前确定性摘要继续默认，AI仅保留受限准备，不扩展3.0路线或宣布主任务完成。

2026-10-19后续上传：用户明确授权后，受控编号候选`ef24640df1c29859353b35033cbb0c7b426d77c4`已正常push原[Draft PR#6](https://github.com/cjwdwb/market-radar/pull/6)，本地/远端HEAD一致。独立包装审计VERIFIED PASS，源码hash未变；新[CI39228360858](https://github.com/cjwdwb/market-radar/actions/runs/39228360858)在Ubuntu24.04/Node22.15执行npm ci→npm test，构建/typecheck及507/507Node通过，0FAIL/0SKIP。归档[上传卡](../tasks/archive/MR-UPLOAD-AI30B-SELECTION.md)，后续仅文档收尾，最新head/checks见PR。无新模型请求，原始回复/预算库/Key未上传；未合并或部署，真实市场解释和生产准入未完成。下方“尚未提交/上传”和远端CI未测描述保留此前开发交接时点。

## 2026-10-19 受控编号协议：本地实现与原名单真实合成复测

本轮基线 `f31ccc12b7547937a51428057b59d0d581fdae0c`，原 `codex/mr-30b-real-provider-pilot` / [Draft PR #6](https://github.com/cjwdwb/market-radar/pull/6)。本轮差异尚未提交/上传，PR未合并，未部署；现有生产记录仍为 Sites v32 / `4a4b7fb66ac4fc10663087b42a09e08c55804e2a`，真实产品模型关闭。远端该HEAD的CI38349505890成功是此前候选证据，不覆盖本轮本地diff。

### 协议与实现

DeepSeek明确启用 `claim-selection-v1 / scoped-catalog-v1 / strict-claim-ids-v1 / bounded-id-selection-v1 / claim-selection-validation-v1 / fixed-claim-restoration-v1`；原v1/v2 schema、validator、OpenAI适配器、fixture、State/Research规则和预算schema均未修改。新增一个 `lib/ai/claim-selection.ts`，接入既有Provider/service/单例CLI，没有新UI、依赖或模型路由。输入投影后一次冻结完整Context、目录、质量规则、对照及请求；服务端映射复用于请求、manifest、校验与恢复。SHA-256作用域包含完整事实/版本/顺序，ID不承担权限。回复只能是1–3个精确ID；不修剪/模糊匹配/文本修复或切回旧协议。

`modelSelected`原顺序、`systemRequired`、按预冻covers差集得到的`systemAdded`、固定文案及引用的`renderedResult`分存。全局限制保留Context来源，不编造Evidence ID；Alignment不足与确认mixed分开，短中方向分歧独立保留。主项资格、重要事实/分歧及多种等价安排在调用前冻结，组织质量不能由系统补齐“救回”。后项可有部分重叠但必须新增事实或明确披露；不要求唯一排序或选满限制。全部数据不足仍在原准入层拒绝。

### 真实执行与逐例评价

用户已明确授权DeepSeek自有合成外发与原共用预算，专用产品Key仅确认当前进程存在、未打印/写盘/读取开发Key。官方10月19日[定价](https://api-docs.deepseek.com/quick_start/pricing/)、[Responses参考](https://api-docs.deepseek.com/api/create-response/)、[指南](https://api-docs.deepseek.com/guides/responses_api/)重新核对：`deepseek-flash`（当日文档别名映射DeepSeek-V4.1-Flash-1017）、none、instructions/json_schema仍适用；高峰未缓存输入$0.30/M、输出$1.20/M未变。沿用用户确认的含税/附加费总额不超过峰值基础费用2倍上界；供应商账单未取得。

付费前独立GPT审计VERIFIED PASS后，按原名单一例一条命令运行，每例新冻结输入、返回后人工审阅再继续。没有循环批跑、自动重试、改Prompt补考、账户探针或切换模型。9次HTTP全部200、返回deepseek-flash、reasoningTokens均0；stale仅本地检查，0HTTP/0预留。每例原始`frozen.json/reply.json/results.json`保持不可覆盖，另写`gpt-review.json`保存人工评价，故原results中的PENDING_GPT_REVIEW不被事后改写。

| 场景 | 是否派发 | 选择合法性 | 模型组织质量 | 程序补齐 | 最终披露 | 对照收益 | 结果/原因 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| aligned | 1次 | PASS | PASS | 16/16 | PASS | 未证明 | 双窗偏上+短方向/RMS；未声称完整Alignment可用 |
| mixed | 1次 | PASS | PASS | 15/16 | PASS | 未证明 | 模型保留短下/中上分歧，另选中RMS低；完整Alignment披露仍由系统补 |
| relative_missing | 1次 | PASS | PASS | 16/16 | PASS | 未证明 | 只选有效方向/RMS；相对维度真实原因仍为等待BTC报价 |
| rms_not_direction | 1次 | PASS | PASS | 16/16 | PASS | 未证明 | 两窗无明显单向结构，短RMS低且明确不等于低风险 |
| transition | 1次 | PASS | PASS | 16/16 | PASS | 未证明 | 原场景实际为unchanged；未编造发生变化 |
| no_events | 1次 | PASS | PASS | 16/16 | PASS | 未证明 | 没有事件不推导平静/低风险/无方向 |
| information_missing | 1次 | PASS | PASS | 16/16 | PASS | 未证明 | 合法渐进顺序，未编造新闻或原因；并不比关系优先模板更紧凑 |
| stale | 未派发 | NOT RUN | NOT RUN | 本地保留32项 | NOT RUN | 不适用 | 准入PASS：insufficient_context，不能算模型质量PASS |
| partial | 1次 | PASS | PASS | 28/28 | PASS | 未证明 | 仅短窗可用；37点要求/当前22点限制保留；与确定性基线完全相同 |
| minute_unsupported | 1次 | PASS | PASS | 16/16 | PASS | 未证明 | 当前方向/RMS有效，分钟历史研究继续unsupported |

数字为系统新增/系统必需披露数量，不是模型贡献数量。所有quality PASS只表示满足事前最低覆盖标准。原名单5例在同一NOW下完整Context相同；全部没有活跃事件或官方资料正例，没有available relative或完整aligned正例，不能据此宣称这些能力经过真实评测。`transition`也不是changed正例。对照收益统一UNPROVEN，不能将安全恢复/完整披露当作LLM增益。

### 用量与预算（USD，不是实际账单）

| 场景 | 输入/输出token | 高峰用量估算 | 2倍费用占用上界 |
| --- | --- | --- | --- |
| aligned | 5051 / 85 | 0.0016173 | 0.0032346 |
| mixed | 5059 / 130 | 0.0016737 | 0.0033474 |
| relative_missing | 5077 / 130 | 0.0016791 | 0.0033582 |
| rms_not_direction | 5068 / 87 | 0.0016248 | 0.0032496 |
| transition | 5060 / 87 | 0.0016224 | 0.0032448 |
| no_events | 5010 / 81 | 0.0016002 | 0.0032004 |
| information_missing | 5049 / 124 | 0.0016635 | 0.0033270 |
| stale | 0 / 0（未派发） | 0 | 0 |
| partial | 4597 / 50 | 0.0014391 | 0.0028782 |
| minute_unsupported | 5118 / 95 | 0.0016494 | 0.0032988 |
| 本轮合计 | 45089 / 869 | 0.0145695 | 0.0291390 |

缓存token合计1024、reasoning0，计算不依赖缓存/低峰优惠。本轮9次预留合计$0.1573206（派发前上限之和，**不是最终费用，也不是当前在途占用**），随后按usage结算为上述上界；原有$0.0053184保留。原pilot/月账本累计11/20次、$0.0344574，unknown/reserved/active均0。试点剩余$0.2155426且最多9次预留；UTC月派发$7门槛剩余$6.9655426，月$8总预算及$1缓冲不变。`billedCost=null`，未实际对账或充值。开发GPT/Codex、开发DS、数据/服务器费用不包含在此产品API统计。

本轮计数：9新增预留、9HTTP、9响应、1发送前拒绝、0缓存命中、0非法选择、0模型组织失败、0系统披露失败、9有效模型复测；原10场景入口均已执行，stale模型质量仍NOT RUN。运行名单完成后停止，没有为用满额度增加请求。

### 验证、审计与证据

Windows / Node22.15.0，本轮新测：首轮86/86专项；核心稳定候选全量506项=505PASS/1既有Windows文件symlink权限SKIP；build/typecheck/局部lint通过。审计后仅CLI计数/旧测试补正，62/62相关回归及lint通过。标准构建最初因共享依赖的Vite临时缓存被沙箱拒绝，runner替代失败；经工具权限复核后原vinext构建成功，不改构建系统。既有>500KB chunk提示保留，无本轮UI改动/可复现性能瓶颈，未调用Optimizer。浏览器、生产登录后和真机本轮NOT RUN；没有新候选远端CI，未将旧CI当本轮通过。

最终CLI小修候选已再跑全量：507项=506PASS/0FAIL/1同一Windows权限SKIP，日志`selection-final-full-node.log`；该结果是本轮实际新测。之后11源码/测试hash与付费前固定版本完全一致，不重复未变产品构建。

独立GPT付费前审计及修复VERIFY：P2重复事实贡献漏判、P2旧OpenAI prepared快照未深冻、P3独立披露失败统计缺失、P3旧v2两项直接反例丢失，均最小修复并复核。独立盘点另检查9可派发确定性基线/倒序与28组合理排列，全部满足冻结规则。主代理负责实现与逐例人工审阅；开发DS Worker本轮没有调用，**9次产品DeepSeek不能记作开发DS参与**。

最终集中独立GPT复核 **VERIFIED PASS，无新增confirmed finding**：11源码/测试hash、39新证据hash与6旧证据hash一致；从冻结Context重建目录/请求并核对原始回复、精确恢复/归因和质量，9例通过，stale无派发。逐例人工评价时间均早于下例开始。审计员以SQLite readOnly核对原库11条请求/profile及费用，未写库/读取Key/调用API；旧两份原始回复重放仍FAIL。实际核对最终507项日志。供应商账单、浏览器、生产、当前远端PR/CI未由最终审计员重新查询，不把这些记为新通过。审计证据摘要另存`outputs/ai30b/selection-final-audit.json`。

主要证据（本地忽略目录，不上传原始回复或预算库）：`outputs/ai30b/selection-execution-handoff.json`含10个runId、39份证据hash、逐例评价、预算和计数；`selection-verified-files.json`为11个代码/测试固定hash；`selection-old-evidence-hashes.json`的6旧原件与10月13日原交接hash再次逐项一致。日志为`selection-{full-node,build,typecheck,lint}.log`及`selection-audit-fix-{tests,lint}.log`。Node测试命令：`node --experimental-strip-types --import ./tests/register-types.mjs --test tests/*.test.mjs`；构建实际`node node_modules/vinext/dist/cli.js build`；类型`node scripts/typecheck.mjs`；局部`node node_modules/eslint/bin/eslint.js`加本次受影响路径。未声称执行Windows下的npm test包装命令。

### 阶段与下一步

A1保留原合成连通PASS，本轮9次新增另记；旧协议A2仍FAIL，原两次失败消费/证据不追认。新编号协议实现/离线验证、9次选择合法性/最低组织标准/系统披露均通过，stale不算模型PASS；不能称真实市场解释已通过或模型优于模板。

B真实市场解释本轮NOT RUN。下一步需要在原任务内核验最小真实输入的数据外发用途及许可、受控snapshot与owner权限路径，并另行冻结真实输入试点范围；当前合成准入不自动升权。现有生产真实模型保持关闭，PR#6保持Draft；本轮不push/merge/tag/deploy。原始账本/凭据不入Git。

2026-10-13后续上传：用户明确授权后，DeepSeek候选`36f3f0a4b8a4b337d0619cb6a3447ff42eeb6aff`已正常推送原[草稿PR#6](https://github.com/cjwdwb/market-radar/pull/6)，tree `3f1e324324d086c4bf3b56b893b30feb81bebcff`与本地相同。独立上传包装VERIFIED；新[CI38349103530](https://github.com/cjwdwb/market-radar/actions/runs/38349103530)实际Ubuntu24.04.5/Node22.15/npm10.9.2、npm ci→npm test，build/typecheck与491/491Node PASS、0FAIL/0SKIP。原chunk/Actions提示保留。归档[上传卡](../tasks/archive/MR-UPLOAD-AI30B-DEEPSEEK.md)，后续仅补文档，最新head/checks见PR。未合并/部署/新增模型消费，原始回复/预算库/Key未上传；A1连通PASS/A2质量FAIL不因CI通过改变。下面未上传/当前CI未跑等为开发交接时事实。

## 2026-10-13 真实合成试点：接口连通PASS，质量FAIL，后续场景停止

用户在Windows账户变量中配置专用`MARKET_RADAR_DEEPSEEK_API_KEY`后，先重新核对9个代码/测试哈希与上轮审计一致、原账本0次/$0，独立GPT只读预检通过。初次存在性检查尚未找到；后续同一登录账户用户变量已存在，读取到当前CLI进程，执行后清除子进程变量；未复用通用开发Key，未写配置文件/秘密/生产。当前HEAD仍`62a01775558fb8afb7536f35148df14406e548d6`，成果是原PR#6上的本地未提交差异。

本轮实际对DeepSeek官方Responses发送两次项目自有合成`aligned`，均HTTP200、返回`deepseek-flash`、completed、cached/reasoning均0。只运行原首例与一次获准的提示澄清后复核；每例新manifest、先预算预留、收到结果后单独GPT审阅。没有自动重试、额外账户探针或批量循环。

| 实际执行 | Prompt | 输入/输出token | 峰值用量估算USD | 含费2倍预算占用USD | 原校验结果 |
| --- | --- | --- | --- | --- | --- |
| aligned首例 | deepseek-instructions-v1 | 3628 / 174 | 0.0012972 | 0.0025944 | FAIL：missing_conflict，将insufficient alignment放进conflictRefs |
| aligned一次澄清复核 | deepseek-instructions-v2 | 3720 / 205 | 0.0013620 | 0.0027240 | FAIL：unsupported_claim，第一句改写catalog原文 |
| 累计 | 同一模型/费率/账本 | 7348 / 379 | 0.0026592 | 0.0053184 | 2次请求、0条可展示解释 |

金额按固定高峰输入$0.30/M、输出$1.20/M计算，结算继续保守乘用户确认的2倍费用上界，不应用缓存/低峰折扣。**上述不是供应商账单，billedCost仍null。** 初始最高预留分别$0.0147606和$0.0150402，收到可信usage后按上述上界结算，失败没有记为免费。原pilot累计2/20；UTC 2026-10与试点占用均$0.0053184，reserved/unknown/active均0。月剩余派发上界$6.9946816，试点剩余$0.2446816/18次；质量Gate停止，余额不是继续执行理由。

### 失败原因与一次限定修正

首例全部摘要句出自原catalog，limitations集合正确，但把`availability=insufficient`的alignment当成已确认冲突。独立GPT重放原回复可复现拒绝；仅在审阅内存将conflictRefs改为[]可通过，不修改保存回复、不把修正后内容当真实模型结果。原提示只写“包含全部可用mixed alignment”，没有明确“只能/没有则空”，与既有精确集合规则之间存在说明缺口。

按原任务最多一次证据支持修正，**仅**在DeepSeek固定instructions追加精确集合与“不可判断不是分歧”说明，prompt版本递增v2；原OpenAI提示、JSON schema、validator、fixture、State/数学、模型、费率、并发/重试与预算未改。新增2项正反例，73/73专项、局部lint与typecheck通过；独立GPT核对新增文本已计完整payload/费用预留、缓存含prompt/body身份、旧失败原样保留，VERIFY PASS后才发第二例。

第二例conflictRefs/limitations已正确，仍因第一句删除了catalog中的“短中窗口方向一致：”前缀而违反逐字引用契约。其余两句来自catalog；本次事实不支持宣称模型发明了价格或因果，但同样不能放宽原校验让它通过。保护机制正确拒绝，不把不合格结果接入UI。

**已用尽本批一次提示修正；停止后续调用。** mixed、relative_missing、rms_not_direction、transition、no_events、information_missing、stale、partial、minute_unsupported九个剩余场景全部NOT RUN；旧mock通过不代表它们真实质量通过。不穷举消耗、不换模型/Provider、不提升思考、不放宽校验。未来若改为只选择受控命题ID、由程序还原原文，应另行定稿输入/输出契约及评估，不在本次临时实施。

### 本轮证据与交接范围

- 首例不可覆盖证据：`outputs/ai30b/synthetic-1791866444335-aligned-rYvgU8/{frozen,reply,results}.json`；复核记录`outputs/ai30b/deepseek-20261013/aligned-first-review.json`。
- 第二例不可覆盖证据：`outputs/ai30b/synthetic-1791866734412-aligned-dOzZym/{frozen,reply,results}.json`。均为自有合成信息，不是当前真实市场事实或observed-live记录。
- 本轮专项命令沿用下节四文件Node入口，结果73/73，日志`outputs/ai30b/deepseek-20261013/node-targeted.txt`；局部lint仅real-config/deepseek-provider/对应测试，exit0；`node scripts/typecheck.mjs` exit0。Node22.15.0/Windows，命令如上，stdout已保存（lint无输出）；退出值来自本轮主执行进程的exit0回报，没有冒称每个输出文件都包含exit字段。
- 全量488PASS/1权限SKIP、build及更广适配测试为2026-10-12历史证据，早于此次v2提示修正；本轮未重复全量/build。修正未涉及UI、schema、预算或金融计算，按影响执行专项/typecheck/lint。浏览器、远端CI、生产及真机本轮NOT RUN；没有以旧证据冒称当前模型验收。
- 独立GPT已在第二次请求前验证限定修正与保护，随后复核第二例、完整账本和最终报告。仅有一项证据措辞精确化：区分stdout日志与执行进程报告的exit0，已修正文档；没有产品代码finding。独立审计不将A2质量FAIL改为PASS。
- 最终定点独立VERIFY PASS：9个代码/测试哈希稳定，2次共6份证据哈希匹配，正式库与`execution-handoff.json`/`budget-final.json`一致，无剩余confirmed finding；没有新增模型请求。该PASS针对实现边界与如实交接，A2质量仍FAIL。

| 阶段 | 当前结论 |
| --- | --- |
| DeepSeek适配/独立审计 | 离线适配已验证；真实Responses、模型与usage解析实际成功两次 |
| A1真实连通 | PASS，仅限本专用账户、此模型/协议和两个合成请求 |
| A2合成质量 | FAIL，首例及一次修正后复核均未满足原输出契约；其余9场景NOT RUN |
| 真实市场输入/当前市场解释 | 未获本轮外发准入，未执行，不因合成调用成功升权 |
| 生产 | DISABLED真实模型；现有Sitesv32保持原状态，本轮未上传/合并/部署 |
| 开发DS Worker | 本轮0；两次DeepSeek调用属于产品合成试点，GPT负责开发、质量、预算与独立审计 |

任务保持质量未通过的明确交接，不宣称3.0B完成。没有未结算费用需要清零；正常行情/State/图表/提醒保持原工作方式。以下2026-10-12“待Key/零请求”等均保留原时点，不再代表当前状态。

## 2026-10-12 DeepSeek切换：离线验证完成，专用产品Key待配置

本节为当前状态；下方Luna与早先单例补正是历史记录，不再作为当前真实执行命令。继续同一PR#6、分支`codex/mr-30b-real-provider-pilot`、HEAD `62a01775558fb8afb7536f35148df14406e548d6`及已有未提交成果。本轮没有commit/push/merge/tag/deploy；PR仍为草稿，旧CI38058872444不是本次DeepSeek候选CI。

用户已明确批准DeepSeek官方API接收项目自有合成场景，费用计入原共享预算，并确认产品账户有可用额度、美元含税与附加费不超过高峰未缓存token费用2倍。通用`DEEPSEEK_API_KEY`不是本次产品Key，禁止复用。当前仅检查专用`MARKET_RADAR_DEEPSEEK_API_KEY`存在性：Process/User均false；不读取、保存或输出秘密。剩余条件只有专用产品Key配置，未发真实模型请求或账户探针。

### 官方契约与本地接收边界

2026-10-12独立GPT定向核对官方[Responses reference](https://api-docs.deepseek.com/api/create-response/)、[兼容指南](https://api-docs.deepseek.com/guides/responses_api/)、[价格](https://api-docs.deepseek.com/quick_start/pricing/)、[错误](https://api-docs.deepseek.com/quick_start/error_codes/)及[限频](https://api-docs.deepseek.com/quick_start/rate_limit/)。文档可用不代表账户实际推理通过。

- 当前CLI固定`https://api.deepseek.com/responses` / `deepseek-flash` / `reasoning.effort="none"`；并发1、重试0、无工具/搜索/自动回退。保留原OpenAI适配器，服务内部默认兼容不改变；CLI明确选择DeepSeek。
- 固定任务规则放`instructions`，Context/catalog放user不可信数据；不发送developer或OpenAI的service_tier/store/background。DeepSeek文档将developer按user处理。
- `text.format.json_schema`已获文档支持；完整keyword子集和`strict`没有明确保证，所以不发送strict，也不宣称供应商严格保证。原本地数字、引用、冲突、限制及金融语义校验保持不变。
- 固定返回模型、response ID、object、状态与usage必须通过校验。billing profile来自固定官方endpoint适配，不伪称服务端返回了计费档位。模型/计费身份或usage不可信时保留全部预留；失败、截断、拒绝、超时不自动退款或重试。
- 本应用只接受单个完成assistant文本消息；官方示例有item.status/role，但schema未标二者required，且可能有多个output_text。因此该接收策略比官方最低格式更窄，真实兼容性仍待首例验证；不因mock通过宣称已测真实返回。与none冲突的实际reasoning正文/usage会拒绝。
- 峰值USD价格：input cache-miss $0.30/M、cache-hit $0.006/M、output $1.20/M。预留和可信usage结算始终使用未缓存高峰上界，不依赖低峰或缓存优惠；`billedCost=null`，估算不是供应商实际扣费。
- 身份包含provider、model、prompt、generation、adapter、price、billing profile，进入结果/缓存/每次冻结manifest。完整请求≤32KiB，输入按UTF-8 bytes+2048余量预留，输出≤2048tokens、响应≤64KiB、超时30秒，与原限制一致。

### 共用账本：已备份并完成添加式迁移

仍使用原项目`data/local/ai-product-budget.sqlite`、同一初始化标记及`MR-30B-SYNTHETIC-001`。UTC自然月总额$8、派发$7；原试点累计最多20次/$0.25，两家费用、在途和未知预留共同计数。

通过迁移前独立GPT审计后，在2026-10-12执行一次显式`--migrate-budget-profiles`。先SQLite `VACUUM INTO`一致备份至项目本地`data/local/ai-budget-before-profiles-y7DGYV/`，保留原库及标记；事务添加`request_profiles`及旧writer防护trigger，metadata v1→v2。旧requests不改ID、金额、状态或时间；每次新请求持久记录provider/model/adapter/price/rates/倍率。旧已打开writer没有profile不能继续写，旧代码遇v2关闭；不得靠还原旧备份清空后续消耗。

新进程逐列比对正式库与备份：旧请求0→0、哈希一致；两库quick_check均ok、倍率仍2。正式零记录不能证明混合历史，非零旧settled/unknown及失败回滚由隔离测试证明。正式迁移前后试点/月占用均0、未知/在途均0、没有模型请求。迁移是本地预算库兼容操作，不是生产数据库迁移；此备份也是同机副本，不是异地保管。

### 本轮新测与审计

环境：Windows10.0.26200 / PowerShell7.6.5 / Node22.15.0；证据在忽略目录`outputs/ai30b/deepseek-20261012/`，没有把Key/授权头/错误响应body写入日志。

| 项目 | 结果与证据 |
| --- | --- |
| CLI/DeepSeek/原OpenAI/snapshot专项 | PASS，71/71，`node-targeted.txt`，全部隔离mock，无外部API |
| 全量Node | PASS，489项：488PASS、0FAIL、1既有Windows symlink权限SKIP；`node-full.txt` |
| build / typecheck | PASS，分别`build.txt`、`typecheck.txt`；分项执行，不冒称运行npm test包装命令 |
| 受影响lint | PASS，exit0；`lint.txt`，不代表全仓既有lint都通过 |
| 迁移/备份/新进程核对 | PASS，`budget-migration.json`、`budget-migration-verify.json`；实际调用0 |
| 独立GPT迁移前代码审计 | VERIFIED PASS，无confirmed finding；另以Node24.19临时库运行6/6迁移相关测试；主代理Node22证据单独核对 |
| 迁移后与最终文档独立复核 | VERIFIED PASS，无confirmed finding；独立只读打开正式库/备份确认逐列哈希、v2身份、倍率与trigger；9个代码/测试文件哈希未变，最新离线manifest来源/Context哈希匹配。未重跑全套或调用模型 |
| 当前浏览器/真机/生产/远端CI | NOT RUN；本轮无UI变更且无上传部署，不借旧五视口/CI冒称DeepSeek实测 |
| 真实DeepSeek请求 / 合成质量 | BLOCKED / NOT RUN；专用产品Key尚未检测到，账户额度与2倍上界已有用户确认 |

实际命令（使用本机已验证的Node22.15.0入口）：

```text
node --experimental-strip-types --import ./tests/register-types.mjs --test tests/ai30b-cli.test.mjs tests/ai30b-deepseek.test.mjs tests/ai30b-provider.test.mjs tests/ai30b-snapshot.test.mjs
node --experimental-strip-types --import ./tests/register-types.mjs --test tests/*.test.mjs
node node_modules/vinext/dist/cli.js build
node scripts/typecheck.mjs
node node_modules/eslint/bin/eslint.js lib/ai/real-config.ts lib/ai/openai-provider.ts lib/ai/deepseek-provider.ts lib/ai/responses-transport.ts lib/ai/real-service.ts lib/ai/product-budget.mjs scripts/ai30b-pilot.mjs tests/ai30b-cli.test.mjs tests/ai30b-deepseek.test.mjs
node --experimental-strip-types --import ./tests/register-types.mjs scripts/ai30b-pilot.mjs --migrate-budget-profiles
```

迁移已执行，不将该命令作为每次启动步骤。当前DeepSeek首例离线冻结见`outputs/ai30b/deepseek-20261012/freeze-final.json`，对应`synthetic-1791818547518-aligned-WJzdw8/frozen.json`；0网络/0预留。冻结不是实际质量验证，真实执行会生成新的当前Context与不可覆盖manifest。Key配置后首例只运行：

```text
node --experimental-strip-types --import ./tests/register-types.mjs scripts/ai30b-pilot.mjs --run --case aligned --deepseek-billing-bound-confirmed
```

产品只读取专用环境变量。安全配置后需让执行进程获得该变量；不要将Key写进命令参数、聊天、`.env`或Git。原`--billing-bound-confirmed`已被拒绝，不能借OpenAI费率确认开启DeepSeek。先检查首例模型/usage/账本/输出与模板，再逐例继续原固定场景；不自动循环、凑满20次或重跑失败请求。

### 当前阶段与费用

| 阶段 | 事实 |
| --- | --- |
| DeepSeek适配 | 离线实现、专项/全量回归及迁移前独立审计已通过 |
| 产品实际请求 / token | 0 / 无真实usage；本轮新增产品请求费用$0 |
| 原试点累计 / 当月累计 | 两者均0次、已结算$0、reserved$0、unknown$0；剩余派发上界分别$0.25/20次与$7 |
| 供应商账单 | 未取得，`billedCost=null`；账户有额度与附加费上界来自用户确认 |
| 合成场景质量 | NOT RUN，不用mock或schema通过替代真实质量 |
| 真实市场输入 / 当前市场解释 | 未获外发准入，未执行；现有State/行情/提醒未改 |
| 开发DS Worker | 本轮实际0次；官方契约调查和独立审计由GPT完成，不将研究DeepSeek文档算DS调用 |
| 生产 | 真实模型未启用；现有Sitesv32保持原状态，本轮未上传/合并/部署 |

未发现可复现性能瓶颈，Optimizer未介入。接下来只等待产品专用Key；不重复申请既有合成用途与预算，不扩大到真实行情或生产。

## 2026-10-12 续接：单例入口补正，真实调用仍受阻

本轮实际对象：Windows 10.0.26200、PowerShell 7.6.5、Node v22.15.0，`worktrees/ai30b` / `codex/mr-30b-real-provider-pilot`。HEAD `62a01775558fb8afb7536f35148df14406e548d6`，开始工作区干净；重新核对PR#6仍为draft、未合并。候选[CI38058872444](https://github.com/cjwdwb/market-radar/actions/runs/38058872444)为success，但449/449属于此前CI证据，非本轮重跑。

用户明确回复“账户目前无可用API额度”。实际Node进程/Windows用户环境的Key存在性均false，仅检查存在性，没有读出、写入或记录Key。费用含税上界及项目可用额度尚未确认；倍率2不替代账户证明。本轮没有执行真实`--run`、充值或另发连通探针。原合成消费授权仍有效，不重新索要相同预算。

2026-10-12重新核对[官方模型页](https://developers.openai.com/api/docs/models/gpt-6-luna)与[价格页](https://developers.openai.com/api/docs/pricing)：Luna Standard input $0.10/M、cached $0.01/M、cache write $0.125/M、output $0.50/M，Responses/Structured Outputs/none支持，与原固定配置一致；不能据官方目录确认该账户的实际推理可用性。

### 本轮变更与本地新测

只改`ai30b-pilot.mjs`及新增CLI测试和本报告/任务索引。每次`--run --case <白名单>`只执行一个原场景并退出，等待GPT逐例审阅；没有整批循环或初始化入口。每例由原fixture生成器按执行时刻生成新Context，TTL仍60秒，stale仍故意失效，原十例内容/标的、模型、账本、价格、校验、金融算法均未修改。唯一正式账本仍为项目根`data/local/ai-product-budget.sqlite`；mock只用临时隔离库。

每例新目录以只写一次方式保存`frozen.json`、`reply.json`（有可解析回复时）和`results.json`。manifest包含候选SHA、CLI内容/diff与原fixture哈希、定义版本、Context/request指纹、原预期/限制、最大预留、账本起点、同输入`claimFor`模板。失败回复在语义校验前取证；HTTP错误body/headers不记录。诊断写入失败单独标记并停止人工复核，不改变既有服务的结算/语义结果。实际HTTP、解析/有效回复、拒绝/截断/超时/校验失败、缓存和前置拒绝与累计预留差值分别记录。

| 本轮验证 | 结果与证据 |
| --- | --- |
| CLI + Provider + snapshot定向mock | 审计修正后PASS，52/52、0FAIL/0SKIP，`outputs/ai30b/cli-20261012/node-targeted-final.txt`；其中新增CLI21项、原受影响31项。修正前48/51项日志另保留 |
| 最终脚本/测试lint | PASS，exit0，`outputs/ai30b/cli-20261012/lint-final.txt` |
| 正式账本只读核对 | PASS，`outputs/ai30b/cli-20261012/budget-final.json`；未初始化、删除、迁移或重置 |
| 单例离线冻结 | 最终修正后PASS，`outputs/ai30b/synthetic-1791814280085-aligned-FSLjDV/frozen.json`；此前两份manifest原样保留。只冻结，不预留/调用。正式运行必须重新生成新manifest，不能复用已过期Context |
| 全量Node / build / typecheck / browser / performance / 新远端CI | NOT RUN；变更仅CLI/测试/文档，历史449项CI分开复用，不扩大重复验证 |
| 独立GPT审计 | VERIFIED PASS，两项P3已修：①遗漏`duplicate_claim` / `missing_primary`诊断码；②预算耗尽/预留后过期等未派发失败错误退出0且控制台省略原因。补原错误码、非预期失败exit1及控制台case/status/code，预期stale拒绝仍正常退出；新增负向测试，计费/校验逻辑未改。独立审计另以Node24.19运行修复相关7/7 mock PASS，并核对主代理Node22的52项/lint证据；无剩余confirmed finding。未验证真实模型、账户或生产 |

实际命令（通过上述Node22.15路径执行）：

```text
node --experimental-strip-types --import ./tests/register-types.mjs --test tests/ai30b-cli.test.mjs tests/ai30b-provider.test.mjs tests/ai30b-snapshot.test.mjs
node node_modules/eslint/bin/eslint.js scripts/ai30b-pilot.mjs tests/ai30b-cli.test.mjs
node --experimental-strip-types --import ./tests/register-types.mjs scripts/ai30b-pilot.mjs --inspect
node --experimental-strip-types --import ./tests/register-types.mjs scripts/ai30b-pilot.mjs --freeze --case aligned
```

首次CLI测试14PASS/3FAIL，原因是JSON持久化省略`undefined`可选字段，测试直接与内存对象比较；改为比较原fixture的同一JSON表示后48项通过，未改变fixture内容、预期金融事实或产品校验。Node SQLite/type stripping实验性警告与Git LF/CRLF提示保留，不冒称无任何warning。

### 真实试点、预算与待补条件

| 项目 | 本轮事实 |
| --- | --- |
| UTC月/固定试点 | 2026-10 / MR-30B-SYNTHETIC-001；月$8、派发$7、试点20次/$0.25不变 |
| 开始→结束累计预留 | 月0→0，试点0→0；本轮新增预留0 |
| 实际HTTP / Provider回复 / 有效回复 / 缓存命中 | 0 / 0 / 0 / 0；本轮未运行真实入口，不能把mock数目填入 |
| 真实成功/拒绝/截断/超时/校验失败/入口前置拒绝 | 均0；账户条件阻塞发生在执行入口之前，不算一次模型拒绝 |
| 已结算 / reserved / unknown | 均$0；active reserved 0 |
| 剩余派发上界 | 月$7；试点$0.25与20次；余额只是代码预算，不是账户API额度 |
| 实际usage / 供应商账单 | usage无真实响应，NOT RUN；`billedCost=null`，没有虚构已对账账单；本轮产品请求新增费用$0 |
| A1真实调用连通 | BLOCKED：账户无可用API额度，Key未配置，含税费用上界尚待确认 |
| A2合成场景质量 | NOT RUN：aligned、mixed、relative_missing、rms_not_direction、transition、no_events、information_missing、stale、partial、minute_unsupported均未做真实调用；mock拒绝不代表真实模型质量通过 |
| B真实市场解释 | BLOCKED：本轮不进入，真实推理用途准入未扩大 |
| 生产 | DISABLED（真实产品模型）；现有Sites v32未改，本轮未上传、合并、部署或启用模型 |

GPT负责本轮修复、核验和独立审计；DS本轮实际调用0，不把此前一次测试草案计为本轮参与。无可复现性能瓶颈，Optimizer不介入。

下一步只需补齐账户可用API额度及费用上界，并在安全界面配置Key；不发送Key到聊天，不创建`.env`，不使用明文`setx`。额度充值由用户自行决定，本轮不代付。当前没有必要提前输入Key。条件补齐后使用下方单例命令运行aligned，检查实际model/tier/usage/语义/费用与同输入模板，再决定下一例。受限目录选句与排序不能冒充开放推理；本轮尚无法判断相对模板是否有质量收益。不能自动重跑已成功同场景、换模型或放宽校验。

以下2026-10-08/10记录保留原时间边界，不替代上述本轮状态。

2026-10-08。离线适配、故障回归和独立审计收尾；真实 Luna 合成试点尚未运行。本报告不是当前市场解释或生产启用声明。

2026-10-10后续上传（用户另行授权）：候选 `411ae1bd3084470b7dd5b9b1f5374547fc85b4cf` 已上传独立分支，[草稿PR#6](https://github.com/cjwdwb/market-radar/pull/6)；tree `02faccf8f16cedc72ade605909275f933e6cc181` 与本地一致。首轮[Ubuntu/Node22.15 CI](https://github.com/cjwdwb/market-radar/actions/runs/38058677276)实际运行npm test（build/typecheck与449/449Node），0FAIL/0SKIP；产品内容与此前审计一致，上传包装另经GPT只读VERIFIED。后续仅补记录，最新PR head/checks见GitHub。[上传归档](../tasks/archive/MR-UPLOAD-AI30B.md)。没有合并main、部署Sites或启用真实模型。下方“未提交/未上传/候选CI NOT RUN”保留开发阶段的时间边界，不代表当前上传失败。

## 基线与实际阶段

独立工作树 `worktrees/ai30b`，分支 `codex/mr-30b-real-provider-pilot`，未提交候选的基线为 `7d2d30f6fe466a4e746ade2b3db231b2cb13b2d4`。PR #5 于 2026-10-08 08:38:33 UTC 合并；main CI [37751192029](https://github.com/cjwdwb/market-radar/actions/runs/37751192029) success 已重新核对。418/418 是原 Foundation 的远端证据，不计本轮候选新测。

现有生产记录仍为 Sites v32 / source `4a4b7fb66ac4fc10663087b42a09e08c55804e2a`。本轮未重新部署，未做生产登录后或 iPhone 验收；GitHub 源码合并不等于产品部署。旧 minute29 / minute-gate29 工作树的 26 个修改/未跟踪文件仍保留，本轮不写入这两个工作树。

| 交付 | 当前结果 | 证据与限制 |
| --- | --- | --- |
| A：固定 Provider、语义校验、持久预算 | PASS（离线） | mock Responses、SQLite、合成契约测试；没有真实模型输出 |
| A：真实合成试点 | NOT RUN | 用户已允许；process/user 的 OPENAI_API_KEY 存在性检查均 false，仅检查存在性、不输出密钥 |
| 合成模型质量 / 相比确定性模板的收益 | NOT RUN | 10 类输入已冻结；严格校验通过也不自动等于模型质量达标 |
| B：受控 snapshot 契约 | PASS（隔离测试） | 复用原 State 数学；真实来源用途准入为空，未配置实际 loader |
| B：真实输入准入与当前市场解释 | BLOCKED | 先满足 A 质量与来源第三方推理/展示权利；没有真实行情外发授权 |
| C：现有 fixture UI / 预算错误态 | PASS（本地） | 原按需 Hook 与往返路径保留；真实 Provider 结果尚未接入公开 UI |
| 新候选远端 CI / 生产启用 / 真机 | NOT RUN | 未 push、merge、tag、deploy 或配置生产真实模型 |

## 配置与价格依据

固定 `gpt-6-luna`、Responses、Standard（请求 `service_tier="default"`）、`reasoning.effort="none"`，并发 1、自动重试 0。没有其他模型/Provider 回退、工具、联网搜索、后台请求或自动续写。输出使用 strict Structured Outputs；拒绝、截断、异常 JSON 或证据校验失败均不展示为成功解释。

2026-10-08 官方核查：[模型](https://developers.openai.com/api/docs/models/gpt-6-luna)、[价格](https://developers.openai.com/api/docs/pricing)、[Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)。Standard 短上下文：input $0.10/M、cached input $0.01/M、cache write $0.125/M、output $0.50/M。官方文档支持 Responses、Structured Outputs 和 none；当前账号实际 entitlement、税费与附加费尚未验证。

完整请求（事实、提示、schema、配置）最多 32 KiB；预留输入上界按 UTF-8 全部字节数加 2048 token 包装余量，不假定缓存命中；生成上限 2048 token，响应流最多 64 KiB，完整调用 30 秒超时。费用预留按全部 input 的 cache-write 单价、output 上限和倍率 2 计算。倍率是保守预算约束，不能当成已确认税率或真实账单。首次付费执行前仍须核对账户实际附加费用上界，确认适用时才能使用 `--billing-bound-confirmed`；超出该上界则停在配置待决，不自动扩额。

`store:false`、无 conversation/background 不等于 Zero Data Retention。[数据保留说明](https://developers.openai.com/api/docs/guides/your-data)中的滥用监测、prompt cache、schema 处理仍须按账号政策区分。首批只发送自有合成事实，无市场数据、私人自选、完整聊天或凭据。

## 单一账本、失败与取消

项目 UTC 自然月产品 API 总预算 $8，派发阈值 $7，保留 $1 缓冲；固定试点 `MR-30B-SYNTHETIC-001` 最多 20 次预留派发且累计占用不超过 $0.25，先达到任一上限即停止。缓冲不保证能覆盖任意未知税费。所有已结算、在途与未知费用计入同一个账本，换用户、资产、任务、模型或进程不能自动清零。

本地权威库：`C:\Users\施文唐\Documents\ChatGPT\Market Radar\data\local\ai-product-budget.sqlite`，同路径 `.initialized` 标记。CLI 按受控脚本位置确定项目根，当前本地 worktree 共用该库；不提供任意 HTTP/客户端路径参数。显式初始化本轮已执行，只有零消费状态。该 SQLite 方案验证的是本机多进程；尚未提供多主机/云端共享账本，生产保持关闭，未来不能各环境新建 $8 配额代替项目合计。

派发前 `BEGIN IMMEDIATE` 原子核对占用和并发，落盘成功才发请求。缺失、损坏、不可安全写入或身份不符时关闭真实调用。删除库而保留初始化标记后也不能静默重建。正常启动不自动初始化，不删除/重置库或标记来恢复额度。

超时、取消、拒绝、解析/校验失败仍计尝试；有可信 usage 和匹配的模型/档位时结算保守费用上界，未知 usage、模型/档位不符时保留全部预留。账单值保持 null，不能把估算写成实际扣费。进程崩溃遗留 reserved 会阻止新并发，需要受控人工核对账单后处理；本轮没有自动退回或重置工具。

重复点击合并同一有效上下文的在途任务；每个订阅者独立取消，仅最后等待者退出才中止共享请求，未知费用不会因此退回。成功缓存 16 条/60 秒，绑定事实、资产、时间、权限与生成配置；读取再次准入，不能把旧快照重绑新行情。

本轮最终只读检查（2026-10 UTC）：

| 项目 | 实际值 |
| --- | --- |
| 产品 OpenAI 请求 / 单次 token | 0 / 不适用（没有真实调用） |
| 试点累计已结算 / 未知预留 | $0 / $0 |
| 当月累计已结算 / 在途与未知预留 | $0 / $0 |
| 剩余月度可派发 / 试点可派发上界 | $7 / $0.25（仍逐次预留、最多 20 次） |
| 本轮产品 API 费用 | $0；账本 billedCost=null，无供应商账单核对 |
| 开发 DS / Codex、行情和服务器费用 | 单列，不属于上述产品预算；不宣称项目总成本只有 $8 |

## 证据、受限综合与真实输入边界

旧 v1 `claimFor` 与引用校验保留。v2 `interpretation-v2` 允许模型选择/排列 1–3 条来自服务端事实 catalog 的确定性命题，含两窗口方向一致/不一致、Direction 与 RMS 是不同维度的说明。它是受限综合，不是开放金融自由写作；没有真实返回时不宣称比模板更有解释价值。

validator 同时核对文字和精确 refs、单位/窗口/数值、重复命题、主要证据、mixed 冲突与全部不可用限制。原 Context 的 mandatory 限制作为结果独立保留。新数字、因果、预测、交易建议、低波动等于低风险及历史胜率等无依据结论均不能通过。

10 类合成场景已冻结：aligned、mixed、relative unavailable、RMS lower、transition、no events、information absent、stale、partial、minute unsupported。冻结配置、输入 hash、预期事实/限制、禁止结论与最高预留；manifest 为 `outputs/ai30b/synthetic-1791452514921/frozen.json`。冻结操作 0 网络请求；它不是实际模型评估。运行时以真实当前时间冻结新的执行批次，同一固定 pilot 共用原账本，过期不自动更新事实来凑成功。

受控 snapshot 默认 `APPROVED_INFERENCE_RIGHTS=[]`，无权利时在 loader 调用前拒绝。未来 loader 候选是已有 `lib/market-data.ts` 的 getQuote/getHistory 与缓存/在途去重，本轮没有接入或请求真实数据。服务端 snapshot 绑定 scope、完整 symbol、事实/用途版本、TTL 及实际资产/基准依赖；返回克隆，读取再次核对原准备规则。relative transition / alignment 若使用基准，同样复核基准时效。原 State/Signal 算法、行情频率、提醒与访问控制未修改。

没有服务器 Radar session 输入时标 `not_included`，不能声称零活跃事件。每字段的第三方 inference、本地解释、公开结果展示权利分别核对；旧公开行情展示许可不是模型外发许可。本地真实服务另有 fixture-only 硬门禁，注入 admit 回调不能直接开启市场输入。B 暂未完成真实来源许可调查或准入验证，生产真实 API 路由未增加。

## 本轮验证与复现

Windows / Node 22.15.0；实际通过现有入口分项执行，未冒称执行 Bash 串联的 `npm test`。

| 新测 | 结果 / 本地产物 |
| --- | --- |
| Provider / 预算 / snapshot 专项 | 31/31 PASS；`outputs/ai30b/node-targeted.txt` |
| 全量 Node | 449 项：448 PASS、0 FAIL、1 既有 Windows symlink 权限 SKIP；`node-full-final.txt` |
| 最终 build / typecheck | PASS；`build-final.txt`、`typecheck-final.txt` |
| 新增与局部修改 lint | PASS、0警告；`lint.txt`。未重跑旧主组件全文件 lint，不冒称全仓 lint 全通过 |
| 五视口 / 现有解释与错误态 | 8 组 PASS；`browser/verification.json` 及 `ai-*.png` |
| 浏览器异常 | pageerror `errors=[]`；console 两条预期 429 错误来自新增故障模拟，未隐去，不能称零 warning |
| 新候选远端 CI / 生产 / 真机 / 真模型质量 | NOT RUN；没有推送、部署、Key 或真实输入许可 |

实际 Node 命令：

```text
node --experimental-strip-types --import ./tests/register-types.mjs --test tests/ai30b-provider.test.mjs tests/ai30b-snapshot.test.mjs
node --experimental-strip-types --import ./tests/register-types.mjs --test tests/*.test.mjs
node node_modules/vinext/dist/cli.js build
node scripts/typecheck.mjs
node node_modules/eslint/bin/eslint.js lib/ai/real-config.ts lib/ai/real-output.ts lib/ai/openai-provider.ts lib/ai/real-service.ts lib/ai/snapshot.ts lib/ai/product-budget.mjs lib/ai/context.ts lib/ai/validation.ts components/radar/use-interpretation.ts scripts/ai30b-pilot.mjs tests/ai30b-provider.test.mjs tests/ai30b-snapshot.test.mjs tests/browser/radar.mjs
```

浏览器复用 `tests/browser/radar.mjs`，`RADAR_AI30_ONLY=1` 与 `RADAR_AI30B=1`；Edge 149.0.4022.98 headless，loopback 生产构建，合成认证/行情、外连拒绝。1440×1000、768×1024、390×844、320×740、844×390；OS reduce 下分别覆盖 normal/system/reduced。包含按需请求、引用/缓存、共享结果、44px、无溢出、手动周期返回、取消/晚到跨资产、未配置及两种预算失败。桌面视口不代表真机。

第一次预览启动缺 TypeScript loader 导致连接失败，修正启动命令后通过；新增失败态脚本错误依赖无结果时不存在的按钮，修正为既有资产返回入口和严格折叠断言，未改产品来掩盖失败。

最终主 client chunk 825,987 bytes；3.0A 本机历史证据为 825,848 bytes（+139），不是本轮新测的成对基线。新 Node-only Provider/账本没有接入浏览器 bundle。既有 500 kB 警告仍存在；无新测可复现瓶颈，Optimizer 未做产品改动。真实模型组合负载、峰值内存、FPS 和前后交互性能 NOT RUN；fixture 延迟不能冒充供应商性能。

## GPT / DS 与独立审计

GPT 负责规划、价格/用途、预算与核心实现、集成和结果定稿。一次 DS 外发在执行前被自动审批拒绝，原因是具体预算文字的外发授权不足；停止该请求后，用户明确批准仅发送“月 $8、派发 $7、20次/$0.25、持久预留与独立取消”文字。随后通过现有 read-only/ephemeral Provider 实际调用 1 次 deepseek-flash，报告 3,013 tokens，实际账单未知；没有发送源码、行情、Key 或聊天历史。证据 `outputs/ai30b/ds/{result,run}.txt`。

DS 给出 6 条测试草案。GPT 采纳合并请求/单订阅取消/最后订阅取消的核查方向；拒绝“全部取消释放预留”的建议，因为未知费用必须保留。$7.90 预留场景不符合 $7 派发约束；“任何未知预留都拒绝下一次”也不是合同，均未直接采纳。配置可用与实际参与分别记录，DS 不是最终审核者。

独立 GPT market-auditor 对固定基线、未跟踪代码及稳定 diff 只读审查；已确认并修复：

| Finding | 修复与复核 |
| --- | --- |
| P2：返回非 Luna 模型仍按 Luna 低价结算 | 模型/Standard 档位不符保留全额未知预留；新增模型与档位负向测试，VERIFIED PASS |
| P2：受控 snapshot 只检查资产，旧基准可能背书 | 保存实际金融依赖，在 get 复核全部 prepareStateInput；relative/transition 基准测试及独立 6/6 snapshot 测试，VERIFIED PASS |
| P3：新增浏览器错误态依赖条件按钮 | 仅修测试选择器/折叠断言；最终 8 组已执行通过，独立最终复核 VERIFIED PASS |

独立 GPT 最终只读复核 VERIFIED PASS，无新增 confirmed finding：18 个审计输入文件 SHA 与 `outputs/ai30b/audit-input-manifest.json` 全部一致，tracked/staged/untracked、报告与各项新测证据吻合。最后一轮没有重跑全套或浏览器，不冒称审计员进行了真实模型、账单、多主机、真机、远端 CI 或生产验证。审计后仅更新结论文字与交接哈希，不改产品。此次结论只覆盖本地离线候选，全部 3.0B 仍未完成。本轮 loopback 测试预览已停止。

## 下一步与安全运行

本轮不归档为全部 3.0B 完成。Key 配置后先检查账号模型可用性及费用上界，再运行一个自有合成请求，检查返回/usage/校验/账本，然后才继续冻结批次。任何关键语义问题停止，最多一次依据明确的修正，仍计原 20次/$0.25 与月预算；不自动换模型或降低校验。

Node 22.15+ 的本地命令（在该工作树）：

```text
node --experimental-strip-types --import ./tests/register-types.mjs scripts/ai30b-pilot.mjs --inspect
node --experimental-strip-types --import ./tests/register-types.mjs scripts/ai30b-pilot.mjs --freeze --case aligned
node --experimental-strip-types --import ./tests/register-types.mjs scripts/ai30b-pilot.mjs --run --case aligned --billing-bound-confirmed
```

最后一条只在 Key 安全配置且实际费用上界核实后执行；本轮没有执行它。不要把 Key 放进命令文字、Git、fixture 或聊天。Key 不存在时保持 NOT RUN；原真实合成授权仍有效，不需要重问同一预算。B 需要实际来源用途决策和 A 质量证据后再推进；C 真实结果接入与生产开启也未获授权。没有购买、充值、密钥修改、真实数据外发、调度、上传或部署。
