# 2.9 Stage B — B-STORAGE-001 本地一致快照交接

2026-10-03补充：[真实长期日频交付](HISTORY_COVERAGE_EXPANSION.md) 已取得BTC/ETH各1828个USD参考值，2021-10-01至2026-10-02，手动增量/固定版本/新空恢复和项目外同机副本已实测。下文B-STORAGE-001的0真实条数是原交接时事实；当前分钟、小时、异地保管等仍未完成。生产现为Sites v30九月切片，本轮长期数据未发布。

2026-10-02；[主台账](../tasks/MR-29-REAL-DATA-WORKFLOW.md) / [阶段卡](../tasks/MR-29-B-HISTORY-EXPANSION.md)。**本批隔离存储能力已验证，Stage B 总目标仍开放。** 真实价格仍为0条；本报告的大库、回放和研究均为明确标注的fixture，不证明A真实通过或真实历史已回补。

## 基线、权限与本批范围

- 本地HEAD与本轮读回的GitHub main：`31702c45c653e5e33bac258c110f159d432d5b87`。历史CI `37004484343` success仅是基线证据；未触发新CI。
- 当前分支 `codex/mr-29-b-history-expansion`；A未提交成果完整保留。B产品增量为 `collector/snapshot.mjs`、`scripts/history-snapshot.mjs`、`tests/history29-snapshot.test.mjs`，以及store两个既有纯校验函数的export。没有schema、依赖、实时算法、来源准入或UI改动。
- 现有生产仍Sites v29，源码 `2ad04ee645ee588b16ede15c43fb093ed395419e`。本批未提交、push、部署、迁移真实库或启用调度；不执行C。
- 正式集合、价格来源用途/许可与采集预算仍待用户决定；项目内位置沿用 `work/state27`。项目外备份位置、保留期限、容量和负责人已单独询问，尚未落实。

## 实现与格式

Node22.15.0实测没有 `node:sqlite.backup()`；SQLite3.49.1支持只读源连接 `VACUUM main INTO ?`。本轮读取[SQLite Backup](https://www.sqlite.org/backup.html)、[WAL](https://www.sqlite.org/wal.html)、[VACUUM](https://www.sqlite.org/lang_vacuum.html)和[Node22.15 sqlite](https://nodejs.org/download/release/v22.15.0/docs/api/sqlite.html)官方正文，4请求均200。技术能力不增加数据使用权。

新格式 `archive-snapshot-v1` 是私有SQLite文件和manifest；恢复产物为新目录内的SQLite和 `archive-restore-v1` receipt。它们与旧16MiB/10000行逻辑JSON备份、2MiB/2000根浏览器包分别存在。旧格式和查询31天/200行限制未放大。

流程：只读源库一致复制 → 核对schema/完整性/归属/事实hash/检查点/来源账本 → 数据文件和pending manifest刷盘 → 主线程在完成、取消、超时之间选取第一个决定 → 成功时最后提交manifest。worker不能自行发布成功manifest。失败目标不被视为完整备份，重试必须使用新目录。

校验按100行分批、SHA256按64KiB分块；逻辑摘要按规范主键排序，避免VACUUM改变隐式rowid/物理头导致伪差异。manifest固定本库readRevision；多月查询每段仍≤31天，共享该revision和序列身份。不同数据库的revision不冒充全局版本。

恢复重新验证输入和副本，再暂停未完成run、保留原有停机原因、关闭collection、清除run/source执行租约。检查点、请求/字节/写入计数、重试次数、冷却和来源请求账本保留；恢复不授予接续权限、不延长原run期限。源备份保持不变。

| 边界 | 实现 |
| --- | --- |
| 输入/产物 | 每次≤256MiB；复制前校验实际文件与page_count×page_size，复制后再次检查 |
| 数据量 | facts≤400000、runs≤10000、pages/source_requests各≤50000、manifest≤64KiB |
| 资源 | worker JS堆128MiB；120秒deadline发起终止；SQLite原生调用的终止延迟未做硬实时证明 |
| 空间 | 预检可用空间≥逻辑源大小4倍+32MiB；不是独占磁盘配额，其他进程占用仍可能令操作失败 |
| 路径/归属 | 仅既有本地守卫允许范围、单owner、全新目标；拒绝链接路径与嵌套恢复到输入bundle内 |
| 安全范围 | schema2精确匹配，来源仍只允许既有fixture/FED契约；checksum不等于授权、真实性签名或不可篡改审计 |

本地文件创建mode不证明Windows ACL已配置。未测断电、硬件损坏、异地恢复，也未验证正式保管权限；不宣称长期保管完成。

## 本轮实测与成本依据

合成 `fixture:CRYPTO:TEST:BBB-USDT:SPOT`，原生标识5m，范围 `[2025-12-01T00:00:00Z, 2026-03-15T04:00:00Z)`；15个有界run，共30000根、固定revision15。没有真实供应商请求或成本。

- 源库保持打开、WAL内有未checkpoint的已提交事实；快照包含30000根。快照后源追加修订，备份与固定版本结果不变。
- 备份 **20062208 bytes（19.13MiB）**，超过旧16MiB和10000行边界。约668.74bytes/合成事实，包含此fixture的表/索引/批次开销，不是实测市场数据压缩率。
- 新进程恢复到新空目标，关闭再开；四段跨年/跨月查询完全一致。900根有界包的回放和研究结果完全一致，31个模拟研究样本；没有真实研究成绩。
- Node24独立专项中，从快照起至恢复/查询/回放核对完成约 **8.63秒**；Node22专项约9.62秒（与构建并行）。这是本机单次功能演练耗时，不是吞吐基准或性能提升结论。
- 首轮24000根只有16056320bytes，未跨16MiB，测试按原断言失败；扩大到30000根后通过，没有降低断言或将失败算成功。

正式资产/基准去重数、市场日历和价格源尚未批准，无法给真实请求/存储账单。仅作容量量级示例：一条24×7五分钟序列按365天为105120根；套用合成系数约67.0MiB，加假设20%修订约80.4MiB，主库及两份备份约241.3MiB。该估算不含未获准原文/原始响应，也不适用于股票全天分母；应以真实试点重新校正。小时/日线不能据此获准或进入现有分钟研究。

## 本轮命令与验证

源码对象为上述HEAD上的A+B工作区，最终B产品hash见阶段卡。日志位于本地忽略目录 `outputs/stage29b`；未把私有数据或巨型日志加入Git。

| 执行 | 实际结果 / 证据 |
| --- | --- |
| Node24.19.0：`node --experimental-strip-types --import ./tests/register-types.mjs --test tests/history29-snapshot.test.mjs` | PASS，9/9；`audit-fixes.log`，含大库、WAL、恢复、4审计回归、拒绝与取消边界 |
| Node22.15.0：相同loader和专项文件（项目已有portable node22） | PASS，9/9；`node22-final.log`；SQLite实验性警告保留 |
| `node node_modules/vinext/dist/cli.js build` | PASS；`build.log`；既有>500kB chunk警告仍在，无新增前端依赖/导入 |
| `node scripts/typecheck.mjs` | PASS；`typecheck.log`；构建之后运行 |
| Node24：`node --experimental-strip-types --import ./tests/register-types.mjs --test tests/*.test.mjs` | 304项、303PASS、0FAIL、1SKIP；`node-final.log`。跳过为既有Windows文件symlink创建权限不足，目录junction用例通过 |
| ESLint snapshot/store/CLI/专项四文件；`git diff --check` | PASS；`lint-final.log`及工作区检查，不声称全仓lint clean |
| B浏览器/真机/生产 | NOT RUN：B没有UI或生产路径变更；A五视口12检查作为历史证据保留，未伪称本轮新测 |
| 真实早期历史/正式接续/异地备份 | BLOCKED：名单、来源用途、预算和外部保管条件未到齐 |

Windows实际运行以上分项，没有运行Bash包装的 `npm test`，也不把旧Ubuntu CI冒充本轮CI。未发现需Optimizer处理的实测瓶颈。

## 独立审计与DS

GPT `stage29b_snapshot_audit` 独立只读审计并用隔离fixture复现4项P2：deadline租约上限差1、恢复丢失budget停机原因、取消与已提交manifest冲突、旧cursor/fingerprint校验遗漏。Builder只做对应修复，增加4项回归；Auditor再次独立执行四项审计测试，4/4通过并VERIFY PASS，无未解决产品confirmed finding。其未独立重跑大库/Node22/全量；最终文档证据复核发现1项LOW超时用例表述，已纠正为“120秒仅配置上限，实际用1ms验证超时分支”，Auditor定点VERIFY PASS，LOW关闭，无未解决confirmed finding。

DS实际1次调用（deepseek-flash/provider deepseek、read-only/never），独立worktree `market-radar-stage29-ds`，只收到GPT定稿的脱敏文字契约；无文件/工具读取、无真实数据或凭据。返回运行手册清单；GPT核对后采纳新目标、manifest、恢复禁采集与缺口说明，并修正deadline与提交语义。模型metadata刷新及PowerShell snapshot能力警告保留；不算Provider改造或DS执行测试。没有其他DS调用。

## 本地操作手册（未启用服务）

1. 检查操作者对源库和数据用途有权，核对Node≥22.15、磁盘空间、单owner及批准schema/source。源和目标均为 `work/state27` 下相对路径；不要输入生产路径或把私有owner/manifest公开。
2. 一次创建：`node scripts/history-snapshot.mjs create <source.sqlite相对路径> <owner> <全新bundle目录>`。不隐式打开既有用户库；工具没有网络与调度。
3. 只有成功返回且存在 `snapshot.json` 才为完整快照；完整bundle包含SQLite与manifest，勿拆开、修改或在线写入。恢复会复核大小/hash、schema和所有逻辑记录。
4. Ctrl+C可取消；失败/超时且无manifest时保留为未完成目标，另建目录重试，不覆盖或清空原库。若完成决定已先胜出则返回成功；操作系统强杀/断电未测，不据退出画面猜结果。
5. 显式恢复：`node scripts/history-snapshot.mjs restore <bundle相对目录> <owner> <全新恢复目录>`。核对 `restore.json`、revision/counts，再按固定版本分段查询和选定短窗回放。恢复不自动运行采集；接续必须沿原计数/冷却且另有范围授权。
6. 真实运行后的项目外备份、ACL、保留/轮换、容量告警与负责人尚未配置；在这些决定到齐前只称本地快照能力。测试目录会清理，不是正式档案；不能宣称脚本在后台继续工作。

## 覆盖与下一批

| 目标 | 本批真实结果 | 未达原因 / 下一入口 |
| --- | --- | --- |
| 日线2021-10-01起 | 0；来源不支持状态尚未逐资产确认 | B1独立原生日线契约，先有批准源/集合；不得增加86400000白名单冒充支持 |
| 原生小时2024-10-01起 | 0；未取得原生小时档案 | B1需交易日、时区、DST/半日市/桶结束与调整证据，不进入90/180/forward30 |
| 必要5m/15m2025-10-01起 | 0；没有A获准试点 | 正式集合/权利/预算 → A真实小试跑及跨run整体限额 → B1冻结早期批次 |
| 信息2024-10-01起 | 本轮0；旧FED两条不变 | B3按来源独立授权，不改FED start扩大范围；不声称全网覆盖 |
| 宏观长期/vintage | 本轮0 | 序列、版本可知性与源权利需批准；latest-vintage不能伪造PIT |
| 长期保管/真实增量 | 本地fixture恢复PASS，正式保管BLOCKED | 项目外位置、保留/容量/负责人；随后真实新空库恢复与有界手动接续，不自动cron |

没有逐资产真实名单，因此不能填实际首尾、分母、修订、缺口原因或最后同步时间。未取得范围保持未完成，不改称休市/上市前/正常无成交。本批到此交接；正式B1/B2/B3仍开放，不自动领取下一批。
