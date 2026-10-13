# Market Radar 3.0B — 受控 Provider 试点交接

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
