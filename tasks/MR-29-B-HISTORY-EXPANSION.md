# MR-29-B-HISTORY-EXPANSION

2026-10-02。Planner定稿本批`B-STORAGE-001`：隔离一致快照/大容量恢复与固定版本跨月读取。真实B1/B2/B3采集仍被A的正式集合/来源/预算缺口阻塞；不改称A通过。本批结束交接，不自动C或更早年份。

## 基线与已有成果

GitHub main31702c45c653e5e33bac258c110f159d432d5b87、CI37004484343 success本轮读回；生产Sitesv29/source2ad04ee。A未提交diff完整保留，从A分支切`codex/mr-29-b-history-expansion`。A输入store副本/tracked.patch在outputs/stage29b/baseline，A三文件blob见阶段A任务。不能以HEAD diff混淆A/B新增。

已重读AGENTS/ACTIVE/CURRENT_STATE/主台账/A交接及Planner/Builder/Auditor。唯一主台账仍MR-29-REAL-DATA-WORKFLOW，不另建并行历史任务框架。原正式清单、来源许可、数据预算没有新答复；不重新索要项目内根目录。已单独询问项目外备份目录/保留天数/容量/负责人，未答复前仅隔离演练。

实际数据：A真实价格0条，无冻结价源/试点序列/逐资产真实覆盖；既有FED两条是旧公开宏观资料，未新采集。日线2021-10-01、小时2024-10-01、5/15m2025-10-01、信息2024-10-01、宏观争取长期对齐均为目标，不是获准批次。

## 依赖 / 本批边界

| 工作 | 本批决定 |
| --- | --- |
| B1更早真实价格 | BLOCKED：无A获准序列；不编名单、不改源准入 |
| 独立原生日/小时 | CONTRACT ONLY：必须保存sourcePeriod、exchangeDate、timezone、bucketStart/End、session/calendar/adjustment版本与完整性证据。DST/半日市/非整点开盘未知即unsupported；不向现有分钟白名单加3600000/86400000，不接90/180/forward30 |
| B2真实扩集合 | BLOCKED：正式范围/预算未获准，数量未知，不按默认数组估“实际资产数” |
| B3资讯/接续 | 旧FED范围不扩大，不改start。真实跨run/pilot预算仍未实现，后续需独立准入。原runner/checkpoint/退避旧行为复用验证 |
| B3存储前置 | 本批实现并实测，只处理既有schema2/fixture或已准入FED；不迁移、不放开真实价格、无HTTP服务 |

## 官方依据与方法选择

本轮4份官方文档200：SQLite backup/WAL/VACUUM，Node22.15 sqlite文档。实测项目最低Node22.15.0 exports无backup函数；SQLite3.49.1支持只读连接`VACUUM main INTO ?`，读取已提交WAL并产生一致快照（单独小fixture能力探针已通过）。不假定Node新版本backup API可用，不直接复制活动主库。

VACUUM INTO完成前中断的目标可能不完整：只允许新目标目录，使用pending文件；成功后校验、sync、manifest最后提交。原库只读，不改journal mode。schema严格匹配现有定义，拒绝其他表/view/trigger；完整性/foreign keys/source-policy/事实hash与引用检查后才交付。显式INTEGER PRIMARY KEY的facts.id及已有revision保留，隐式rowid不是跨快照身份。

## B-STORAGE-001冻结契约

1. 新本地工具复用`localFile`限制在work/state27；新隔离子目录`stage29b`，源路径不隐式取用户库。create/restore目标都必须新空目录；禁止覆盖/符号链接、任意SQL/URL、对外服务。物理快照为单owner私有资料，混owner拒绝；不输出资产/owner明细到终端。
2. `archive-snapshot-v1`：SQLite schema2物理副本+有界JSON manifest；格式/schemaFingerprint、SHA256、字节、事实/修订数量、readRevision、createdAt、私有owner标识。非浏览器包，不修改旧history-local-v1/v2或history-package-v1。hash不等于签名或来源授权，只允许可信本机操作员的自有备份。
3. 硬界：每次输入/产物≤256MiB，facts≤400000，runs≤10000，pages/来源ledger≤50000，manifest≤64KiB；逐页最多100行，文件哈希64KiB块，不构造全库JSON。SQLite复制前使用page_count×page_size和文件大小检查，复制后再校验；独立worker在120秒deadline发起终止，原生SQLite调用的终止延迟未作硬实时承诺；部分产物无commit manifest，绝不冒充成功。工作空间预留至少输入4倍+32MiB，检查失败停止。以上是本机演练工具限制，不是付费/真实采集授权。
4. restore先校验manifest/schema/内容，再一致复制到新pending库，事务中关闭collection、暂停未完成run并保留既有停机reason、清除执行租约（source和run），保留cursor/requests/bytes/pages/writes/page_attempts/retry_not_before/来源last_dispatch及请求ledger；这些安全修改写恢复receipt，原snapshot不改。不能根据旧租约自动续跑，真实采集仍须独立授权。
5. manifest在文件校验及fsync后由主线程统一完成/取消决策并最后发布，worker只准备pending；失败/中断保留可识别pending目标，不允许读取为完整备份，不覆盖清理其他目录。重试使用新目标，不在残留产物上猜进度；绝不无限重试。fsync不冒称已做断电/异地恢复实验。
6. 多月读取复用A显式readRevision：先在同一DB确定一个版本，各31天以内段沿同一版本/周期读取。恢复库沿同snapshot版本；不同DB数字revision不得拼成全局版本。日/小时仍unsupported，不装分钟包。

准入校验复用store的现有config/fact纯校验（只导出以复用，不改逻辑）；不复制金融或来源门槛。快照核对run/page/fact引用、每run预算和checkpoint链、source ledger/冷却，对异常明确失败。无schema/index变更；大JSON旧限额不变。

## 估算与执行停止点

本批只造fixture：至少20000根原生5m合成bar，跨月/跨年、5m/15m混序列和修订另测；确保全库超过旧10000行界。另一个有界大fixture/实际文件体积证明超过16MiB仍可一致备份；若成本不足只报告覆盖到的边界。批次最多运行专项/全量测试及一次失败修正回归，不启动真实爬取。记录真实DB/备份大小与bytes/fact，不推广为市场来源压缩率。

正式规模仍未知：按实际批准资产/交易日历另算，不用24×7股票分母；原始响应/全文保管权利未取得不保存。长期备份外部位置/期限/负责人未配置，测试产物在临时/忽略目录不是长期保管。

## Allowed paths / 角色

GPT：collector/snapshot.mjs、scripts/history-snapshot.mjs、collector/store.mjs仅现有纯校验导出、tests/history29-snapshot.test.mjs及必要fixture、tasks/ACTIVE和本卡/主台账、docs/HISTORY_STAGE_B.md、docs/API_CONTRACTS.md。旧A产品diff保留不重写。无依赖/框架/schema/实时/源policy/UI变更。

DS：独立worktree，固定契约后仅运行手册片段/覆盖检查清单，禁止真实数据库/名单/凭据/环境读取；一轮实施最多一次指定修正，GPT核事实后采纳。GPT独立Auditor审查固定B diff及A继承边界；只读，发现后Builder定点修复/VERIFY。没有性能瓶颈不Optimizer。

## 测试 / 验收

Node22最低版和当前24：旧schema/导出兼容；WAL源仍打开且未checkpoint时包含committed事实；快照后源再写不污染备份；>10000行/>16MiB；跨月/年固定revision；A→B→A版本；哈希/schema/source/owner篡改拒绝；行/字节/deadline/存在目标/链接限制；取消/partial拒绝；新进程恢复/重开；checkpoint/冷却/预算保留且无过期lease执行；同输入短窗数学/研究结果完全等价。真实归档/真实接续与长期保管NOT RUN，不拿fixture通过填补。

稳定后相关lint/Windows分项build/typecheck/全量Node。无前端变更，本轮浏览器沿用A同源证据并标历史；不无关重跑。更新本批记录，长期B保持开放，不push/tag/deploy或进入C。

## 执行结果 / 固定候选

本批已完成隔离实现与验证；[完整报告及操作手册](../docs/HISTORY_STAGE_B.md)。30000根fixture/15个有界run、20062208bytes、revision15，跨年/四段跨月查询、WAL活动源、新进程恢复/重开、900根回放/31个模拟研究样本结果一致。首轮24000根未超过16MiB导致断言失败，扩大fixture后保留原断言通过。真实价格0、真实回补/增量/长期保管仍BLOCKED，不归档成Stage B全部完成。

最终Node24全量304项/303PASS/0FAIL/1既有Windows文件symlink权限SKIP；Node22.15和Node24快照各9PASS；build、typecheck、受影响lint通过。详细命令和本地日志见报告；本轮没有CI/浏览器/真机/生产新测，未改前端故沿用A历史浏览器证据。已核对120秒配置上限；1ms超时分支及manifest提交边界已测，未运行120秒超时实验，原生SQL中途终止延迟未测。

独立GPT审计4 confirmed P2：lease截止边界、预算reason丢失、取消/commit竞态、cursor/fingerprint校验。已按finding修复，独立4项测试PASS/VERIFY，无未解决产品confirmed finding；审计不替代主代理Node22/大库/全量证据。文档收口复核发现1项LOW超时测试表述不准，已改为上述配置上限与1ms实际实验；Auditor定点VERIFY PASS，LOW关闭，审计范围无未解决confirmed finding。

固定B源码SHA256：
- collector/snapshot.mjs：8A5C74B056EF153DFA859B9DA640ED03322BCC04320F5FA2885A91A94E5A244B
- scripts/history-snapshot.mjs：415D27B3485CD46EFE8D4B37680014679980FC934E76751A9F87FE864C8A3B2B
- tests/history29-snapshot.test.mjs：6C86B940150C92F076878565776423F27888CA168DEF47B6AA82AB4F182D6342

DS实际1次只读文字清单派单，无工具/文件读取，GPT审核后采纳运行手册部分；独立DS worktree没有文件改动。Optimizer跳过，没有性能问题证据；合成单次耗时不是提速结论。本地未提交/未发布，无真实库迁移、后台采集或C；达到本批交接点后停止。
