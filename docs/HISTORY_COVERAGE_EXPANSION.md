# 2.9 长历史真实交付 — CM-LONG-20261003-001

后续发布（2026-10-03）：本报告数据现已随GitHub PR#3/main源码c28de66与Sites v31上线，查询每页31日，118页与本地SQLite一致；新公开适配/五视口/CI/独立审计记录见[发布卡](../tasks/archive/MR-PUBLISH-LONG-REFERENCE29.md)。以下“未发布/v30”及测试数字保留为采集开发阶段当时记录，不能覆盖此后发布事实。分钟/异地保管等未完成范围保持。

2026-10-03；任务 [MR-29-HISTORICAL-COVERAGE-EXPANSION](../tasks/MR-29-HISTORICAL-COVERAGE-EXPANSION.md)。本轮长期日频已实际入库、查询、恢复；真实分钟仍 BLOCKED。未宣称完整 2.9 完成。

## 基线与执行对象

| 对象 | 本轮核对 |
| --- | --- |
| GitHub main / 候选 base HEAD | `da1b2ed33f067dc65600ab0d3e256a64046e6e26` |
| 已有远端 CI | run `37104853462` completed/success；历史 main 检查，非本候选 CI |
| 独立候选 | `codex/mr-29-historical-coverage-expansion`，未提交工作树；最终文件清单/摘要在 `outputs/coverage29/candidate-manifest.json` |
| 当前生产 | 原生 Sites 查询 active / v30；生产源码 `749c7270fc14f6bd1440c86e9f871b48a6b19409` 按发布记录核对 |
| 本轮对象 | 本地 schema2 归档、禁采集恢复副本、生产等效本地 workerd 构建；不读取生产 Cookie 或访问码 |
| 发布 | **本轮未 push / merge / tag / deploy**；现有 Sites v30 继续运行九月切片 |

原工作树的加密行情诊断成果保留。旧九月 API 库60/60、五月 CSV 提取库46/48本轮用新代码只读打开成功，读取前后文件哈希未变；两条2026-05-24空值仍为 `missing_value`。本次 API 当前版本覆盖五月，但没有改写旧 CSV/旧批次的缺值事实。

## 来源与用途决定

用户已明确免费非商业网站。Community 官方产品页与 CC BY-NC 4.0 允许在相应条款下非商业保存、研究、分享及衍生；保留署名、许可链接、修改说明、无担保说明，不以网站访问控制限制接收者已获得的许可权利。该许可不是受限付费市场数据的访问凭证。

本轮重新核对的官方材料：

- [Coin Metrics Community](https://gitbook-docs.coinmetrics.io/packages/coin-metrics-community-data.md)：免费产品、日频与许可。
- [CC BY-NC 4.0 legal code](https://creativecommons.org/licenses/by-nc/4.0/legalcode.en)：2(a)(1)、3、4 的非商业复制、分享、改编及数据库权利/条件。
- [Reference Rate 指标定义](https://gitbook-docs.coinmetrics.io/coin-metrics-prices/coin-metrics-prices/reference-rate-metrics.md)：参考价身份；计算时点不是发布时间。
- 官方 `community-api.coinmetrics.io/v4/catalog-v2/asset-metrics`、`catalog-v2/market-candles` 与 `timeseries/asset-metrics` 有界实际查询。数据许可判断不以 HTTP 200 代替。

| 路线 | 身份、原生粒度与实际深度 | 当前访问/实际测试 | 保存/研究/免费公开展示/衍生/导出 | 成本 / 决定 |
| --- | --- | --- | --- | --- |
| Free：Community PriceUSD | 聚合 BTC/ETH USD 参考价，1d；目录最早 BTC 2010-07-18 / ETH 2015-08-08，最晚2026-10-02 | 目录200；2021首日/最新完整日小样本200；14次实际回补成功 | APPROVED，遵守上述 CC BY-NC4 署名等条件 | 免费，无新订阅；**APPROVED 日频** |
| Free：Community ReferenceRateUSD | 1m参考价，非exchange OHLC；目录约2026-09-26至10-03，9月30日小样本有值、9月1日为空；5m返回400、15m返回400 | 有限实际验证；产品页“最近7点”与目录/样例不完全一致，不外推稳定留存承诺 | Community许可不改变产品语义或历史深度 | 免费；**BLOCKED 分钟OHLC/90d** |
| Paid access：Coin Metrics market candles | 候选 Coinbase BTC/USD、ETH/USD spot；未取得原生5m/15m、90d/1y目录授权 | catalog返回403 “Requested markets are not available with supplied credentials”；停止该产品，不换身份/市场绕过 | 需具体 entitlement 与用途合同；保存/公开展示/导出均不因Community许可自动批准 | **quote required / BLOCKED** |
| 后备：CoinPaprika Enterprise | 既有资料提出5m/15m/redistribution候选；90d/1y、市场身份、原生OHLC和保存条件均待当前确认 | 本轮 NOT VERIFIED，未调用、未购买 | 项目用途/导出/衍生须独立核验 | **quote required / NOT VERIFIED**；不称“低价已获批” |

既有 Binance 候选的公开再分发权利仍不清楚，本轮没有再试下载；不把“非商业”自行解释为任意来源都允许。当前无法证实一个免费或低价分钟方案完整满足全部条件，未发出询价或购买请求。

来源检查证据转录：`outputs/coverage29/source-check-transcript.json`列本轮独立来源代理的11项URL/UTC时刻/HTTP/完整响应体字节和原工具chunk ID；原始调用在聊天工具记录，未保存这些检查的完整原文/响应hash。此转录不是再次抓取或原始响应存档。实际回补的14个原始响应则确实保存在SQLite内并有SHA256，二者区分。

原 `benchmarkFor` ETH-USDT→BTC-USDT、BTC禁止自比保持不变。USD参考价不接入USDT benchmark；分钟源未准入，不改 ArchiveStore 的真实 source/session gate，也没有新增 State v3。

## 冻结范围与实际覆盖

计划 `CM-LONG-20261003-001` / policy `cm-community-nc-daily-v2`。每批截止冻结，UTC半开目标 `[2021-10-01, 2026-10-03)`；2026-10-02为执行时最新完整日。每个 PriceUSD 日期的证据截止为次日00:00 UTC，来源公开时间未知。

| Asset | Source / series | Target | Actual source dates | Records | Missing / gaps / revisions | Dataset version |
| --- | --- | --- | --- | --- | --- | --- |
| BTC | Coin Metrics / PriceUSD / USD / 1d | 2021-10-01 至2026-10-03不含 | 2021-10-01–2026-10-02 | 1828/1828 | 0 / 0 / 0 | `4f85a328fb895c82e6db5841b64f28bc7f5492b67fb07df95af3de1210c687eb` |
| ETH | 同上，独立asset身份 | 同上 | 2021-10-01–2026-10-02 | 1828/1828 | 0 / 0 / 0 | 同一固定读取版本 |

网格有值不证明价格准确或PIT。全部为后来收到的 `reconstructed / current_vintage`；没有伪造过去的 receivedAt、observed-live 或预测记录。逐值保留首次收到/版本收到时间和原始响应SHA256，聚合摘要明确标为“响应集合摘要”。

| 已领取批次 | 范围（UTC，截止不含） | 两资产来源记录 | 新事实 | HTTP |
| --- | --- | --- | --- | --- |
| BACKFILL-2021 | 2021-10-01 → 2022-01-01 | 184 | 184 | 2 |
| BACKFILL-2022 | 2022-01-01 → 2023-01-01 | 730 | 730 | 2 |
| BACKFILL-2023 | 2023-01-01 → 2024-01-01 | 730 | 730 | 2 |
| BACKFILL-2024 | 2024-01-01 → 2025-01-01 | 732 | 732 | 2 |
| BACKFILL-2025 | 2025-01-01 → 2026-01-01 | 730 | 730 | 2 |
| BACKFILL-2026 | 2026-01-01 → 2026-10-02 | 548 | 548 | 2 |
| INCREMENTAL-20261003 | 2026-09-30 → 2026-10-03 | 6（4条重叠） | 2 | 2 |
| 合计 | 不把重叠计作第二条事实 | 3660 | **3656** | **14** |

每批JSON及前后目录在 `outputs/coverage29/`；原始响应与请求账本在库内。手动增量依赖两资产既有连续批次检查点，只取两日重叠+一个新完整日。再次运行同一增量 **0请求、账本不变**。旧读取版本 `a89ecefe8d2f4317c83c41edbef4126d11f14976dc7ca98a8df841c99bf5176a` 仍可查询，10月2日在旧版是 `not_backfilled`，不会被新版悄然填入。

未领取 `REVISION-01/02`；真实来源本次没有修订。A→B→A、空值/缺日修订是确定性测试证据，不冒称真实发生。近三日以外修订没有持续复查服务；下一截止/更早修订需要新增明确批准的版本化批次，不能改旧manifest或自动滚动运行。

## 存储、查询、恢复与消耗

保留一个 `CoinMetricsArchive` 入口，schema1旧pilot不迁移；schema2增加请求/响应/逐日版本表与索引。预留请求先落盘；原始响应、事实修订、checkpoint同事务。重复同值不增加事实，缺值不补零，未请求与来源缺失分开。查询版本跨年稳定、单页≤31日，浏览器不驻留多年全库。schema2本地查询服务仅接受禁采集恢复副本，避免长读事务阻塞采集库。

| 资源 | 实际 |
| --- | --- |
| 日频真实回补/接续 | 14 HTTP；314495响应体bytes |
| 主代理日期小样本 | 3 HTTP；374响应体bytes |
| 独立来源核验 | 6 API/2331 bytes，5文档GET/721554 bytes；其中一个200 PageNotFound未作为证据 |
| 上述来源动作合计 | 28 HTTP / 1038754响应体bytes；不含GitHub/平台管理读取、TLS/headers开销 |
| 请求硬边界 | 计划共享20请求，每响应128KiB、总预留2.5MiB；请求30秒、批次120秒、间隔≥1秒；401/403阻断、429保留冷却，不自动无限重试 |
| 主库 | `work/state27/coinmetrics-long20261003/archive.sqlite`，**684032 bytes** |
| 一致逻辑快照 | `work/state27/coinmetrics-long20261003/backup-20261003.json`，**805893 bytes**，独立schema2格式≤8MiB；旧schema1上限不变 |
| 恢复副本 | `work/state27/coinmetrics-long20261003/restore/archive.sqlite`，**684032 bytes**，enabled=false |
| 项目外同机副本 | 工作区上级 `backups/market-radar/CM-LONG-20261003-001/` 内快照与新空恢复库；与项目副本校验一致 |
| 费用 | 此源免费，数据订阅新增$0、未建云资源；DS调用/网络等实际账单 unknown，不声称所有运行费用为0 |

实际恢复到新空存储，核对全部118页/3656值、逐事实时间/hash/版本、目录和账本。关闭后另起Node进程再次读取逐资产摘要一致；项目外副本恢复再复核一致。独立审计另外逐页复核，联合分页摘要 `4da350287b65f5c4b16c00cd8231dd8261b98b157d6e5ac82c54aaa0b0aca423`。

证据：`outputs/coverage29/real-verification.json`、`legacy-real-verification.json`。恢复保留消耗/冷却、清除旧执行租约、默认禁采集；没有在线简单复制SQLite主文件。进程中断/失败/超限/租约恢复为隔离测试；没有为验证故障破坏真实库。

### 容量与保管边界

真实日频主库约187 bytes/值（含当前索引/响应），本批主库+快照+恢复约2.1MiB，当前本地架构足够。主库硬限16MiB/12000事实版本/18成功响应，不无限调大旧浏览器包。

真实分钟仍0，不能给出实测分钟空间。使用**既有30000根fixture快照20062208 bytes**约669 bytes/bar作初估（非真实来源测量）：

| 假设集合，两周期均保留 | 原生15m+5m根数 | 单份主库存储初估 | 2倍修订/开销余量，再保留两份同尺寸备份 |
| --- | --- | --- | --- |
| 5资产 × 90日 | 172800 | ~110MiB | ~661MiB |
| 10资产 × 90日 | 345600 | ~221MiB | ~1.29GiB |
| 5资产 × 365日 | 700800 | ~447MiB | ~2.62GiB |
| 10资产 × 365日 | 1401600 | ~894MiB | ~5.24GiB |

这些不是新采集授权，也不是供应商报价；原始响应、压缩率和修订频率需真实分钟preflight再校准。分钟继续用现有ArchiveStore/物理快照，不塞进此日频小库或无限内存JSON。

现有分钟物理快照上限为256MiB/400000事实（`collector/snapshot.mjs`），不能据“磁盘够”声称上述一年/多资产组合可直接装进单库快照。首个90日单资产单周期估算可先保留现边界；后续超过上限时，最小候选是按明确序列/日期有界分卷，加固定多卷manifest及共享来源预算，分别核验恢复和跨卷查询。该扩展尚未实施，不把多库局部revision当全局版本，不在源未获准前扩建。

**异地长期保管仍未完成**。最小建议：将本批约0.8MiB校验快照复制到用户已有异地目标，保留不可变版本+校验manifest；下载至新空库恢复并校验后才计异地PASS。未来分钟估算预留至少10GiB足够上述假设留余量，但未选服务、未开通或承诺费用。当前不删任何旧快照；保留期限/负责人/异地位置待明确。项目外同机副本不能抵御同机丢失，未把它当长期保管验收完成。

## 实际使用入口与运行手册

从现有历史工作区“连接本地归档数据库”连接隔离只读服务，展开“日频参考价格”：选BTC/ETH及UTC日期，查询后每页≤31日；跨年/闰日可翻页，固定dataset version。覆盖、来源、精确数值、每条取得时间默认折叠。失败保留明确标为旧查询的结果，旧响应不能覆盖新资产。返回实时图表保留手动周期。生产Sites v30仍只有已发布九月包，不能据本地入口说长期历史已上网。

所有命令在本候选根目录执行，Node≥22.15；路径只允许 `work/state27` 下相对文件。不要传任意SQLite、SQL、URL或生产路径。

```powershell
# 只读状态；已完成批次再次执行不会重新采集。
node scripts/coinmetrics-history.mjs long-status
node scripts/coinmetrics-history.mjs long-query btc 2021-10-01 2026-10-03 <固定version>
# 全新文件名，拒绝覆盖；恢复自动禁采集。
node scripts/coinmetrics-history.mjs long-backup coinmetrics-long20261003/<新快照名>.json
node scripts/coinmetrics-history.mjs restore coinmetrics-long20261003/<新快照名>.json coinmetrics-long20261003/<全新恢复目录>/archive.sqlite
```

已完成 `long-collect BACKFILL-2021`…`BACKFILL-2026`、`long-collect INCREMENTAL-20261003`。本轮停止领取批次；不启用cron/daemon。收到403、429、预算/质量错误即停止，按账本处理，不通过换库/run重置预算。下一批必须保留此配置和旧版本兼容，显式冻结新截止/批准范围。

只读服务沿用 `scripts/history-workbench.mjs`，参数为 `- <占位owner> <占位journal> <loopback预览URL> <端口> coinmetrics-long20261003/restore/archive.sqlite`，凭据通过 `RADAR_ARCHIVE_TOKEN` 会话环境传入，不写报告或Git。服务仅loopback、会话最长20分钟，退出即停止；本轮已结束的验证服务不代表持续运行。

## 分钟、回放、研究交付状态

| 对象 | 本轮结果 |
| --- | --- |
| Real minute preflight / 90-Day Pilot | **BLOCKED**：Community已验证参考价非OHLC、无90d；市场catalog拒绝当前entitlement |
| 真实5m/15m bars / gaps / revisions | 未采集，不用0条宣称覆盖0%准确分母；目标保持最近90日先BTC单组合 |
| 真实Short90m/Medium180m Direction/RMS Replay | **NOT RUN**，缺合法完整分钟输入；1d明确unsupported_frequency |
| Relative/Alignment/Transition真实历史 | 继续开放，不猜基准、不改State规则 |
| 真研究候选/保留数/min/median/max | **NOT RUN**；无合法分钟输入，不填0、不降低minimum10或改协议 |
| 前瞻真实登记/成熟 | 本轮未登记、未核验成熟结果；旧机制不当作本轮真实成绩 |

分钟准入后仍按原契约：1资产×1原生周期×1–3日preflight；先Direction/RMS→预算内90日→再ETH/5m。源身份、session、成交量单位、完成bar、实际gap、版本存储/查询/恢复需整体验证；不只解除fixture gate。当前停止对应源数据动作，不阻止上面的实际日频交付。

## 本轮验证与测量

| 检查 | 结果 / 范围 |
| --- | --- |
| 全量Node（最终） | **PASS：368通过 / 0失败 / 1 Windows symlink权限skip，共369项**；`node --experimental-strip-types --import ./tests/register-types.mjs --test tests/*.test.mjs`，`outputs/coverage29/node-final.log` |
| Node22.15专项 | **PASS：49/49**，四组CoinMetrics文件，包含后加HTTP恢复隔离与429清理两项；`outputs/coverage29/node22-final.log` |
| build / typecheck | **PASS**：`node node_modules/vinext/dist/cli.js build`、`node scripts/typecheck.mjs`；既有>500kB chunk警告保留，无新增性能架构 |
| 受影响eslint | **PASS**；collector三文件、CLI/workbench、类型/组件、CoinMetrics新测试、现有browser、新performance入口；命令与空日志在outputs |
| 首次全量环境失败 | 共享node_modules junction的Vite缓存EPERM；没有削弱测试，获准缓存访问后完整重跑通过。失败日志保留，不冒称首跑PASS |
| 五视口浏览器 | **PASS：11组检查**；Edge149.0.4022.98，1440×1000 / 768×1024 / 390×844 / 320×740 / 844×390；真实恢复日频+模拟实时行情/认证 |
| 旧九月发布入口兼容 | **PASS：10组新检查**；同候选本地构建HTTP/真实九月发布包，五视口、无会话拒绝/POST拒绝、503/409和旧响应/折叠取消、三档偏好、返回周期；`browser-legacy/verification.json`，不是生产验收 |
| 浏览器场景 | 2021长范围、2023→2024跨年、2024-02-29、31日边界、固定版本、逐值来源、键盘/44px/无溢出、默认折叠、返回1周周期；受控旧响应/新资产503失败保留/重试 |
| console/pageerror | pageerrors=[]；长历史一条预期503，旧入口405/503/409来自拒绝/隔离故障注入，不隐去；性能运行warning/error均为空 |
| 动效范围 | 长历史五视口减少动效；性能两视口标准动效；旧入口三档偏好新测、偏好/存储语义随全量Node回归。未称完整新真机动效矩阵 |
| 生产登录后、iPhone真机 | **NOT RUN**；未发布，不用桌面模拟代替 |
| 远端候选CI | **NOT RUN**，本轮禁止push；历史main成功单列 |
| 独立GPT Audit | **最终 VERIFY PASS**；完整稳定diff/10文件hash、真实数据/恢复及报告证据只读复核，无确认产品或表述finding；范围限制见下方 |

浏览器复用 `tests/browser/radar.mjs`，本轮 `RADAR_REFERENCE_ONLY=1 RADAR_REFERENCE_LONG=1`，另执行 `RADAR_PUBLISHED_REFERENCE_ONLY=1`；合成认证仅loopback。截图/JSON在 `outputs/coverage29/browser/`及`browser-legacy/`，代理实际查看1440/320px截图；五视口均有截图，未调用生产源。其他旧Stage C fixture浏览器场景未重跑，相关数学/研究/接口包含最终Node回归，不把历史浏览器报告冒充新测。

性能复用 `tests/performance/fixture.mjs`，新增 `tests/performance/reference29.mjs`。本地Windows 10.0.26200 / Intel Core Ultra 9 275HX、Edge149.0.4022.98、Node24.19.0、同候选生产构建、真实推进时钟、标准动效；日频用实际3656值固定版本，实时报价为fixture。无CPU节流，不测真机/刷新率/外网provider latency。前后优化收益**不作声明**：旧版没有这条多年查询能力，本轮未进入Optimizer。

| 测量 | 1440px，3次 | 390px，3次 |
| --- | --- | --- |
| 单页HTTP响应耗时 min / median / max | 3.46 / 5.21 / 9.32 ms | 2.91 / 4.97 / 11.16 ms |
| 点击→DOM更新后下一帧 min / median / max | 10.8 / 16.5 / 26.6 ms | 11.3 / 16.4 / 28.1 ms |
| 采样JS heap峰值 | 17397804 bytes | 22161184 bytes |
| 查询开始后长任务≥50ms | 0 | 0 |
| 每次3次显式查询→实际HTTP | 3，无重复导航请求 | 3，无重复导航请求 |
| 普通行情请求 | 每次17秒场景12条含既有分组/轮询/显式切换 | 同左；没有降低刷新频率 |

另做两次组合窗口：每视口约3秒内12个真实本地页查询，与图表拖动/键盘/滚动重叠；窗口内各观察到1次正常fixture报价响应。查询端到端约3.16–19.97ms，无长任务或pageerror，结束active/pending均0。无人工延迟，数据库不会整库传给浏览器。证据 `performance/report.json`、`performance-combined/report.json`。

取消/旧响应胜出测试使用隔离延迟：改变资产中止旧等待，释放旧响应后不能覆盖新结果。SQLite单页查询很短且同步，未宣称可中途打断已执行的SQL；“取消”是停止等待/忽略旧结果。DB逐SQL扫描次数 **NOT MEASURED**，HTTP无重复不等于证明无重复SQL。真实分钟分析耗时 **NOT RUN**；堆采样不是全进程内存或GC释放保证，0观察长任务不等于真机高刷。

## 协作、审计与未完成项

GPT主导来源/身份/契约/schema/核心实现；独立GPT先计划审计，三项P2澄清（逐事实原始来源、目录与页覆盖、高水位与恢复副本读写隔离）在Builder前纳入。2026-10-03独立GPT最终 **VERIFY PASS**：稳定产品diff、10文件hash、真实库/恢复118页及同机副本、最终Node/Node22/build/typecheck/browser/performance日志与报告逐项一致，无确认产品或报告表述finding，不需要FIX。来源转录和256MiB/400000边界又经单独补核通过。

审计未重新联网抓取条款/接口，其来源判断与6API/5文档统计依赖本轮独立来源代理工具证据；不声称原始全文已存档。生产登录后、真机、异地恢复、真实分钟研究不在PASS范围。验证服务已经停止，没有遗留常驻采集任务。

DS实际一次 read-only `deepseek-flash`，仅获准三个非敏感文件目录/组件/测试盘点；GPT采纳31日分页、跨年/闰日/缺值测试建议，没有采纳未证实的controller重构建议。Provider元数据fallback警告保留；没有DS写入、来源决策、自审通过或生产数据外发。

本轮完成的是 BTC/ETH 五年日频与有限手动增量的本地真实交付；其余保持主台账开放：

- 合法原生分钟source/entitlement/明确报价 → preflight →90d；通过后下一批才扩6m/1y及批准资产。
- 2024-10小时线、2025-10分钟、资讯/宏观/vintage与更广真实集合，不用此次日频替代。
- 异地目标/保管责任和期限、下一截止有界增量、明确旧日期修订窗口；没有持续云服务。
- 历史Relative/Alignment/Transition、真实研究样本、前瞻成熟结果。
- 长日频公开网站发布须另行授权；当前本地有用，Sites v30保持原发布内容。
