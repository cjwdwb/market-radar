# MR-29-HISTORICAL-COVERAGE-EXPANSION

2026-10-03 — GPT Planner 定稿。继续 2.9；不新增版本、不发布。

## 基线 / 保留

main / HEAD da1b2ed33f067dc65600ab0d3e256a64046e6e26；本轮只读确认 CI37104853462 success（历史CI，不是新候选）。Sites当前active/v30，生产源码749c7270fc14f6bd1440c86e9f871b48a6b19409以发布记录为据。原工作树有 ACTIVE 与 MR-CRYPTO-RECOVERY-30.md 未提交诊断成果，原样留存；新独立worktree/branch codex/mr-29-historical-coverage-expansion。从main开展，本轮无push/merge/tag/deploy。

九月60真实值、五月46/48与两个missing_value、旧CSV九月0/60均不可变；不迁移或改写原库。原ArchiveStore、分钟fixture/研究/journal、Sites v30日频发布包不重做。

## Source / Coverage Decision

Coin Metrics Community官方产品页2026-10-03 HTTP200明确Creative Commons BY-NC4及免费Community；适用用户已明确的免费非商业保存/研究/署名公开展示及按许可导出/衍生。官方目录PriceUSD：BTC min2010-07-18、ETH min2015-08-08，均1d/max2026-10-02；主代理实际3小请求200/374bytes验证两资产2021-10-01及2026-10-02。

来源身份保持coinmetrics:community:PriceUSD:1d:v1 / composite_reference / USD / UTC日终（sourceDate次日00:00证据截止）；不是OHLC、USDT或observed_live。current_vintage，不证明PIT。新源版本为响应SHA256及数据读版本，不编sourcePublishedAt。

分钟：已核Coin Metrics ReferenceRateUSD/1m可读但非OHLC；Coinbase BTC/USD与ETH/USD candle catalog HTTP403 entitlement拒绝，不绕过、不采集。保持真实分钟Pilot/Replay/Research BLOCKED；最终来源报告保留实际深度及候选，不能把参考价当candles。分钟ArchiveStore source/session/replay门槛不松动。

## 冻结Data Plan / 硬边界

计划CM-LONG-20261003-001，policy cm-community-nc-daily-v2，btc/eth，PriceUSD/1d/USD；目标[2021-10-01T00:00Z,2026-10-03T00:00Z)，每资产1828日期。6个日历年切片（2021仅10–12月，2026截至10-02不含），每片两资产；最终incremental取[2026-09-30,2026-10-03)，相对已完成高水位重叠2天+新增10月2日。每次显式领取一个片；不自动滚动到未来。

正常12+2 HTTP；全计划20请求，单响应128KiB，总预留2.5MiB，单请求30秒，批次最多120秒，source最小1秒间隔。预留在SQLite事务中先记账，跨run/进程/批次共用；429保存Retry-After、403/401永久阻塞该计划，其他失败停止当前调用，不自动重试。reserved崩溃仍消耗预算，30秒租约后可显式接续。恢复禁采集，不能恢复重置额度/冷却。

只用固定official host+endpoint+assets+metric/frequency，无用户URL、无重定向、无任意分页URL。年度请求page_size1000，可容最多366日；任何continuation返回即拒绝完整性，不静默截断。原始响应有界保存在库内，与事实/checkpoint同事务提交。

本地库work/state27/coinmetrics-long20261003/archive.sqlite；旧库不动。预估响应~0.32MiB，归档主库<4MiB，主库+两份备份<12MiB，硬库16MiB/12000修订事实/18成功响应，备份8MiB。来源免费无订阅；云成本0（未创建资源），DS账单未知。真实行/bytes测量后修正量级，不将同机备份叫异地。

## 最小演进 / 时间版本 / 查询

保留CoinMetricsArchive唯一入口，新增显式schema2多批次后端模块；旧schema1原样打开/恢复/导出，无自动迁移。新库添加式建表：冻结计划、请求账本/批次检查点、原始响应版本、逐日值或缺失原因修订。一个逻辑键=source+asset+metric+currency+frequency+UTC date；与最后版本比较，同值不增事实，A→B→A保留第三次变化；缺日/空值均可修订但不填0。首次取得与当前版本取得分别保留。

请求成功的原始响应、修订和checkpoint同一事务；失败不推进。高水位只沿已遍历批次连续范围推进，缺值/缺日另记gap。固定版本取各键截至版本的最后事实；数据版本可跨年查询，一页≤31日期/现有UI≤31值。目录仅聚合counts/range，缺口逐页展开；浏览器不驻留多年全库。

只读会话保持固定事务，旧读版本可重现。schema2工作台只接受enabled=0的恢复副本，拒绝采集库长读，沿用rollback journal，不在原库并行读写。每条价格保留firstReceivedAt/versionReceivedAt/sourceVersion；聚合provenance摘要明确为响应集合摘要，非单一raw。目录总量/缺口计数与分页缺口分开，not_backfilled不冒充missing_date；旧读版本计数据该版本派生。

schema2有界导出仍与旧格式区分，恢复到新空库、验证raw重算/哈希/事实/时间/预算后发布；恢复清租约禁采集、保留消耗/冷却。不改变旧1MiB pilot包或分钟16MiB/2000bar契约。Node22/24兼容。增量需两资产全部回补到2026-10-02，随后两资产最终窗口逐次提交。额外两组REVISION-01/02仅用于显式有限近3日复核及fixture测试，总请求仍共用20上限，真实本轮不自动领取它们。

独立GPT计划审计3项P2契约澄清已纳入上述逐事实来源/分页覆盖/恢复副本策略；无P1阻止本地日频。

## Allowed paths

collector/coinmetrics-{api,archive,series}.mjs；scripts/coinmetrics-history.mjs；lib/history/reference.ts；components/radar/reference-history.tsx；必要时scripts/history-workbench.mjs（既有安全边界不变）；tests/coinmetrics-*.test.mjs、tests/browser/radar.mjs（新flag复用）、tests/performance仅必要测量；本卡/ACTIVE/主台账、docs/HISTORY_STAGE_A.md、docs/HISTORY_STAGE_B.md、docs/CURRENT_STATE.md的当前事实索引及docs/HISTORY_COVERAGE_EXPANSION.md；忽略outputs/coverage29及work/state27/coinmetrics-long20261003。

不改ArchiveStore分钟/State/Replay/Research数学、门槛、实时接口/刷新、门禁、monitor、依赖、生产配置；不扩资产、不做cron。

## 测试 / Audit

先相关Node：跨月/年/2024闰日、半开区间/未来日/单位、同批重跑0请求、同值幂等/A-B-A/缺失修订、错误冷却/403/429/oversize/取消/中断租约、跨批预算、失败checkpoint、旧版本、长范围分页、恢复禁采集/新进程重开/旧May/Sep兼容。实际年度回补逐批记录；新空恢复逐值比较，增量只取3天不全量重下。

稳定后全Node、build/typecheck、受影响lint、既有五视口harness扩展长范围分页/旧响应失效/返回周期/动效。生产和真机NOT RUN。本地组合测量query latency/longtask/memory/cancel/实时刷新，分钟analysis因未准入NOT APPLICABLE，不据fixture称真实研究完成。无实测瓶颈跳过Optimizer。

独立GPT对schema/恢复/预算/版本/真实报告审计，固定候选finding→修复→VERIFY。DS实际1次read-only（三个非敏感文件）；采纳31日分页、闰日/跨年/缺口测试建议，不采纳无证据的controller重构提醒。没有DS写入或权限/算法决策。

## 交付仍分列

代码/真实数据/目标覆盖/本地查询/同机保管/异地/分钟研究/生产分别判定。LongDaily具备条件直接Builder及真实执行，Minute只停止对应采集。未达分钟、长期小时/分钟、Relative/Alignment/Transition历史、正式更广名单、异地及前瞻成熟结果继续主台账开放。

## 2026-10-03 实施与真实交付

已执行6个回补批次+1有界增量：14HTTP/314495响应体bytes，BTC/ETH各1828值、2021-10-01至2026-10-02，0缺口/0实际修订；真实库684032bytes、备份805893bytes。118页逐条恢复/另起进程及项目外同机副本一致，已完成incremental重跑0请求。旧May/September只读兼容且哈希不变。完整报告：[HISTORY_COVERAGE_EXPANSION](../docs/HISTORY_COVERAGE_EXPANSION.md)。

最终全Node368PASS+1既有Windows权限skip、Node22专项49PASS；build/typecheck/受影响lint、长历史五视口11组+旧九月路径10组检查与六次常规/两次组合性能测量通过。独立GPT最终VERIFY PASS，无确认产品或报告finding；补核来源转录与容量边界通过。分钟catalog403/参考价深度语义不足，仅该数据动作BLOCKED；无付费、迁移、调度、上传或部署。新候选在独立worktree，生产仍v30。本批交接停止；原生分钟/异地等继续开放，不自动领取下一批。
