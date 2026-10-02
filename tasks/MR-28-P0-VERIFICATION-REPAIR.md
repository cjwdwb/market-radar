# MR-28-P0-VERIFICATION-REPAIR

2026-10-02，P0有界隔离修复。用户完整指令为本轮附件b2c3c6fe；不push/merge/tag/deploy，不进入P1–P3，不操作真实库或生产资源。

## 基线与 Planner

隔离工作树 `../market-radar-p0-repair`，分支 `codex/mr-28-p0-repair`，基线/main `27b0bab92d5e5cd5072abcdb3550d1ac9571cd1d`。原工作树干净且原位保留。无等价P0任务。生产仍2.8 Foundation/Sites v28/source75cfa06；本轮发布权限不沿用。

原审查run36995381868/job110800789451/attempt1，checkout c978520：281测试/276通过/5失败。最新run36999220149/job110812813714/attempt1，checkout27b0bab：281/278/3失败。两者均Ubuntu24.04.5，runner image20260927.320.1，Node22.15.0/npm10.9.2；npm ci成功，npm test在build/typecheck后测试失败。最新commit只文档/注释，不是失败修复。原本地Windows Node24.19通过证据保留，不能替代CI结果。

必要原始摘录保存outputs/p0/evidence，完整日志仍可从上述GitHub job读取。没有将完整环境/凭据放进任务卡。

| 编号 | 原测试身份 | 最新CI | 调查/修复状态 |
| --- | --- | --- | --- |
| SQLITE-1 | fed-history: source is guarded before HTTP; one successful page stores real receipt identity and repeats are idempotent | 此次通过，原ERR_INVALID_STATE保留 | 查statement/iterator生命周期与运行时 |
| SQLITE-2 | history: duplicate retry, source correction and A-B-A return have distinct stable versions | ERR_INVALID_STATE，assertIdentity93 | 同上，不先假定同因 |
| SQLITE-3 | history: cutoff, native interval, OHLC, completed and universe validations reject bad bars | 此次通过，原ERR_INVALID_STATE保留 | 同上 |
| PATH | history: CLI confines paths and refuses to overwrite databases or backup files | Missing expected exception，131行盘符路径 | 核对字符串与解析位置，不能冒称已真实逃逸 |
| DEMO | release28: downloadable synthetic example is reproducible, valid and supports the frozen research minimum | deepEqual失败 | 固定原exportedAt，对照价格/canonical/digest |

## 初始可执行范围

GPT负责根因、契约、最小修复；DS可整理固定事实清单或低风险边界测试草案，不决定安全/数值规则。最后独立GPT只读审计。无性能瓶颈目标，不启动Optimizer。

先复现再定稿写入：调查collector/store.mjs、scripts/history-local.mjs、scripts/prepare-history28-example.mjs及对应tests、package/scripts/CI。只允许这些相关路径的最小修复及必要回归；允许public/examples/history28-fixture.json在明确生成规则后由唯一生成器重建，保留原时间。lib/history/package.ts只调查，默认不修改校验契约；不动schema/来源准入/State/Signal/刷新/权限/研究协议/依赖。

本机实测Windows x64/Node24.19.0/V8 13.6.233.17-node.51/SQLite3.53.3/Asia-Shanghai；WSL未安装、Docker不可用，没有Linux执行工具。可下载校验官方Node22.15.0便携版至隔离outputs目录，形成同OS换Node对照。Linux完整入口必须独立记录BLOCKED，不能用Windows替代。隔离npm ci不触及原工作树node_modules。

## 验收和停止点

保留修复前证据；逐项验证三项SQLite失败、身份/修订/分页/事务/恢复，严格路径契约和无副作用，固定模拟生成/完整性/旧合法样例/回放研究。稳定候选运行相关tests、完整验证入口（可用环境如实分项）、受影响lint和本地样例导入浏览器。独立GPT AUDIT/FIX/VERIFY后交接；不得宣称未运行Linux或远端新CI通过。

P1：正式集合/价源/费用/保管沿用MR-HISTORICAL-INTELLIGENCE-28及HISTORY_FOUNDATION，不新增采集。P2：历史时间选择入口仍为history-workspace，不新增控件。P3：已有tests/performance/history28.mjs，后续再测与行情/图表并行，不先重构。

## 根因契约与实际结果

已确认的限定实测：同Windows下Node22.15定向56/53/3失败（FED幂等、unsafe信息拒绝中的assertIdentity、样例），Node24.19为56/56。后一个信息拒绝失败与原SQLite同栈，纳入同根因。原三项SQLite测试身份不因某轮偶然通过而删除。

最小SQLite复现：同一内存连接3行，temporary prepare().iterate()在每行global.gc()时Node22迭代到第1行即ERR_INVALID_STATE，连接SELECT1仍成功；显式保持statement活跃则完整6求和，Node24两种均成功。证明Node22该写法的资源保活兼容问题；不归咎真实数据库损坏。批准assertIdentity改成按owner/run_id有序keyset分页、每页100条的同步all；保留逐条source/asset身份拒绝和外部事务，不全量加载或全仓替换iterate。

路径契约定稿：仅根内相对名称；两种分隔符按路径处理，可接受safe/../nested和合法混合分隔符。拒绝空/非字符串、根本身、逃逸/兄弟前缀、POSIX绝对、Windows盘符绝对或相对、UNC/设备、冒号/ADS、控制符/不可移植设备文件名及末尾点/空格。保持符号链接与junction拒绝，含断开的符号链接。所有CLI输入/输出路径在mkdir/open之前预校验，不放开已有恢复目标或导出覆盖。旧Linux的Z:/会解析到受限根内，是语法契约未对齐，不称已发生目录逃逸。

样例定稿：固定exportedAt1790935326955、302根5m、2026-09-01起点及身份。Windows Node22与24第一差异为bar149 close103.02453939278817/103.0245393927882，另bar176共8个OHLC字段；分类/10样本统计在该对照未变，canonical/digest不同。批准仅演示生成器采用BigInt精确有理复利100×(10002/10000)^i，USD按1e-8单位正数四舍五入（半数向上），high/low在同整数单位加减0.01。再转Number用于原parser/replay/research，不动通用精度/阈值。用唯一生成函数按原时间重建样例，保留旧完整文件于隔离证据并验证仍可导入；不手改digest、不降最少样本。

Builder允许写入：collector/store.mjs（仅assertIdentity）、scripts/history-local.mjs（路径契约及先验顺序）、scripts/prepare-history28-example.mjs（演示数值）、public/examples/history28-fixture.json（唯一生成路径）、tests/p0-verification.test.mjs与必要fixture子进程、tests/history28-release.test.mjs（保留旧断言再补边界）、tests/browser/radar.mjs（已有history28段补损坏/旧包兼容验证）、一份docs/P0_VERIFICATION_REPAIR.md及本卡/ACTIVE/CURRENT_STATE事实补记。CI、engines、锁文件、schema、parser、金融算法保持不变。

当前Linux执行环境缺失，npm ci已在隔离Windows/22.15/10.9.2按原锁文件成功（676包）；不能写成Ubuntu原环境已复现。真实路径文件系统行为用本机验证，Linux最终npm test和新源码远端CI保持待补。

同根因范围补记：新增205-run恢复回归在Node22实际复现exportSnapshot的temporary prepare().iterate()同样ERR_INVALID_STATE（first-fix-node22.log）。批准仅该导出循环改用rowid有序、每页100行的同步读取；保持原表集合、导出顺序/格式、事务、行数与逐行字节上限，不替换无关调用。此项属于用户允许的同根因/阻断验证问题。

新fixture预期修正：首次新增恢复断言误把run.status期望为paused；原实现/契约是保留run.status并将archive_meta.collection_enabled设为0。只修正新增fixture为ready及collection_enabled=0两项断言，原恢复实现和原用例不变（targeted-node22.log保留首次断言失败）。

## 稳定候选交接（独立审计VERIFY完成，P0门槛未闭合）

仍为基线27b0bab上的UNCOMMITTED DIFF，没有修复提交。代码/测试/样例8文件哈希见outputs/p0/candidate-manifest.json；其余4个文件为本任务文档/索引。完整证据与逐项限制见docs/P0_VERIFICATION_REPAIR.md。

- 三项原SQLite测试、原CLI路径和示例测试均在最终Node22/24完整发现范围内通过；原281项未删除，新增7项后288项、287pass、0fail、1skip（仅新增Windows文件symlink权限受限项）。
- 最终命令：Node22/24 `--experimental-strip-types --import ./tests/register-types.mjs --test tests/*.test.mjs`；日志full-final-node22.log/full-final-node24.log。加强身份/导出各10次GC断言已包含。
- Windows build/typecheck分项通过，受影响lint最终0诊断。未声称Bash包装npm test或Ubuntu成功。
- 本地Edge149.0.4022.98 / workerd / synthetic auth，12条历史浏览器检查，5视口与3档动效；下载新示例、旧合法包、回放/10样本研究、坏digest保留原数据及查询均通过。errors/warnings空，冻结时钟查询API增量0，仅fixture实验。
- DS实调1次整理脱敏CI摘要；GPT仅采纳核对后的事实，不采纳额外环境建议。独立GPT Auditor另行只读，不以DS或主代理自检代替。
- 本轮不改真实数据/来源准入/schema/State/Signal/研究规则/CI运行时，不发布；原工作树核验仍干净，HEAD27b0bab。

独立GPT审计：1项LOW（history-local遗漏COM¹、CONIN$/CONOUT$等设备名）；仅补正则与5个bad路径用例。修复后verify-node22.log/verify-node24.log均288/287/0fail/1skip，lint-verify.log无诊断。审计员独立VERIFY运行6项/5pass/1skip，核对8文件哈希与修正范围，结论PASS，无未关闭finding。完整分工及证据见报告第4节，摘要outputs/p0/audit-summary.json。

P0继续开放：Ubuntu24.04.5/Node22.15完整npm test BLOCKED；修复源码远端CI NOT RUN；文件symlink权限项NOT RUN。独立审计不等于原环境验证通过。P1–P3仍不实施；未提交、未发布，不归档为全部通过。
