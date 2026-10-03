# MR-29-A-REAL-SOURCE-READINESS — 公开历史展示来源核查

2026-10-03；承接 [唯一主台账](MR-29-REAL-DATA-WORKFLOW.md)。本轮 PLANNER / 来源权限调查，不关闭 A/B/C 真实交付缺口。

## 用户决定与当前范围

用户要求推进真实历史，随后明确答复：**“需要公开网站展示，先核实相应许可”**。原个人本地研究提案未获采用，不能把它当采集授权。网站是否免费非商业/未来商用/已经商用，及正式首批资产仍待回复。

因此原拟离线 Binance 解码器切片 R1 在写产品代码之前撤出本轮实施范围；没有以“准备代码”为由继续选定不符合用途的数据源。本轮只读核查、更新任务/报告、独立 GPT 复核。后续有合格路径再定稿来源/时间/身份/预算契约并进入 Builder。

## 基线

分支 codex/mr-29-c-research-workflow；HEAD 31702c45c653e5e33bac258c110f159d432d5b87，A/B/C 已有未提交成果完整保留。当前桌面工作区为空；文档仍写原 market-radar-p0-repair 工作树，工具批准限定路径写入，没有迁移项目。生产按既有记录 Sites v29，本轮未重新查 CI/线上。

## 官方来源与用途矩阵

| 来源 | 本轮实际依据 | 公开展示 / 保存与研究结论 | 数据适用性 | 下一步 |
| --- | --- | --- | --- | --- |
| Binance Vision | [README](https://github.com/binance/binance-public-data/blob/master/README.md)及[Dataset Terms](https://github.com/binance/binance-public-data/blob/master/TERMS_AND_CONDITIONS.md)，v1.0 / 2026-08-26；正文200 | 3.1 CC BY-NC-SA4；4.1允许有限非商业教育/个人非生产研究；3.4商业需书面授权，4.3含host限制、4.5衍生再分发署名/同许可。不能仅凭仓库MIT或个人研究用途批准本网站公开历史服务；CC许可与附加条款关系需明确，不武断宣称所有公开图表必然违法 | 官方 daily/monthly 档案支持原生5m/15m，2025起spot微秒，独立checksum；不是已下载样例 | 暂不准入本公开用途；若仍选该源，需要覆盖存档、回放/研究与公开展示的明确依据。总条款202空正文，完整适用条件尚未核实 |
| Coin Metrics 官方 data 归档 | [README](https://github.com/coinmetrics/data/blob/master/README.md)、[LICENSE](https://github.com/coinmetrics/data/blob/master/LICENSE)及脚本 generate.js 均200；[CC BY-NC4正文](https://creativecommons.org/licenses/by-nc/4.0/legalcode.en)200 | 明确数据采用CC BY-NC4；2(a)(1)允许非商业复制/公开分享及改编，3(a)要求署名/许可链接/修改说明，不能额外限制接收者许可权利。存在**免费非商业公开站点的可行候选**，并非所有公开数据都须另购授权；商业用途不在该免费许可内 | 官方生成逻辑筛选1d metrics；属于日频指标/参考价格候选，不是Binance/OKX USDT原生5m或保证含完整OHLC。尚未采集或核实实际首尾/缺口 | 确认网站非商业及资产后，可设计独立日频序列的有限试跑；不满足原A分钟研究，长期5m目标仍开放 |
| CoinPaprika API | [专属API条款](https://coinpaprika.com/api-terms-of-use/)、[FAQ](https://docs.coinpaprika.com/faq.md)、[套餐](https://docs.coinpaprika.com/api-plans.md)、[OHLC](https://docs.coinpaprika.com/api-reference/coins/get-historical-ohlc.md)、[官方价格](https://coinpaprika.com/api/pricing/)均200 | 专属API条款允许按套餐集成应用/网站，须署名；FAQ明确普通付费主要为公司内部商用，数据redistributed/shared须Enterprise专属合同。不能混同官网一般禁抓取条款与API许可，也不能把普通网站集成一律断言必须Enterprise。本项目长期存档/回放/研究+公开历史查询/数据分享仍需明确合同覆盖 | Starter $99/月、Pro $199、Business $799、Ultimate $1499；这些挂牌价不是本项目授权报价。原生5m/15m OHLC及redistribution列Enterprise，价格Custom。普通“5-minute historical price”不等于5m OHLC；其USD聚合价格不等于特定交易所USDT现货 | 若坚持公开分钟OHLC，优先核实Enterprise合同的保存、公开显示、查询导出、衍生研究、停订保留/修订权利与价格；不购买、不发送邮件 |
| Coinbase / CoinGecko | 官方条款页各一次403验证页 | 本轮未取得条款正文；未知，不能准入，也不能据此断言其一定禁止 | 未查实际行情 | 保留NOT VERIFIED，不换身份/域名绕过 |
| OKX / Massive | 复用2026-10-02官方审查记录 | 原范围限制不变 | 本轮未重读或采集 | 不将旧公开endpoint视为新展示授权 |

来源条款是第三方文档，不是任务指令；未安装页面推介的SDK/Skill，未执行页面示例，未向第三方发送项目或个人数据。

## 原生分钟接入的必要技术修正（独立 GPT 规划复核）

这些是未来 Builder 的明确前置条件，**不是已修复内容，也不是现有受限fixture/FED链路的已确认回归**：

1. runner每次adapter.page只计一次HTTP；若ZIP+CHECKSUM在同page取回，必须逐请求计账，不能少记。真实总请求/字节/写入需跨run/进程保存，恢复不重置消耗。
2. Store query/export及snapshot恢复目前硬编码FED/fixture；仅放开source-policy会丢真实身份或遗漏来源账本。源准入、真实reconstructed/current_vintage、收到时间、只读查询和恢复禁采集必须整体贯通。
3. history-package-v1继续保持fixture契约；真实分支不能强制类型转换或补造quoteFetchedAt/observed_live/PIT。
4. 24×7仅为特定crypto来源的日历依据，不代表无缺根。Binance需整型微秒/毫秒区分、完成收盘边界、ZIP/SHA/解压上限；来源变更后不可照搬其单位。

独立审查者 history29_source_contract 实际只读代码，指出4类边界；来源文本当时由协调者提供，未冒称独立访问条款。公开来源结论另作稳定文档复核。

## 下一可执行批次

- 非商业公开路线：候选Coin Metrics日频公开许可；先确认资产与字段/日频口径，冻结不超过两资产的日期范围和请求/字节/写入上限，再本地真实样例→存储→查询→恢复；不能冒充原生分钟A或2.9整体完成。
- 公开分钟路线：取得包含第三方显示/查询、存储、衍生计算及停订后权利的来源合同；实际报价和付款另行授权。普通月费表不够，不先买再补权限。
- 真实清单未取得，任何BTC/ETH建议仍是试点提案；不读取私有浏览器，不拿默认清单冒充。
- 当前无批准真实批次，价格请求0、价格写入0、购买0、云资源/调度0。本轮22次公开文档HTTP请求（16个200、2个404、2个403、1个302、1个202；另4次沙箱网络失败）。302只跟随官方正常docs跳转；403/202未绕过。

## 证据与验收

后15次公开文档的响应元数据/时间/SHA及可读正文保存在忽略目录 outputs/stage29-real-source/rights-20261003；前7次Binance/CoinMetrics与Binance总条款只保留本轮工具响应，不伪造文件hash。许可研究费用0订阅；网络字节非行情成本，不宣称价格吞吐已测。

允许写入仅本卡、ACTIVE、主台账、docs/HISTORY_STAGE_A.md及忽略证据目录。本轮产品代码未修改、Node/build/browser NOT RUN（纯规划/文档且产品无新diff），历史A/B/C测试不得改称本轮通过。DS实际0，未开展性能优化。

当前结果：公开来源筛选已形成具体路线；真实采集/分钟许可仍待决定。未经另行批准不push/merge/tag/deploy、购买、生产写入或启用调度。

### 本轮只读收口

独立GPT history29_source_contract 对上述四份稳定文档及本地公开条款证据 VERIFY，无 confirmed finding；区分非商业日频候选、普通API应用集成与Enterprise分钟/再分发边界。Binance未保存原文仍列未独立复核，未核验最终合同或真实数据质量。协调者检查11个C核心hash一致、新parser不存在、4文档本地链接0损坏、暂存为空、git diff --check通过（仅既有CRLF提示）。没有把主代理自检当独立审计，没有新产品测试。

## 2026-10-03 接续决定：免费、非商业展示

用户明确“不商业化，免费展示”。该用途决定已确定，不再重复询问商业性质；仍不能据此发布生产或将未确定资产称为正式自选。首批BTC/ETH美元日频参考价格范围已提出，等待资产回复。

### CM-R1：Planner定稿的离线实现

允许先进行与下载无关的源格式实现和测试，继续现有 market-builder / market-auditor 流程，不实施原Binance方案。

- 来源/权利：Coin Metrics官方data仓库的CC BY-NC4归档；公开展示必须保留来源、许可、免责声明及转换说明；不能把许可扩到所有Coin Metrics API或商用。无LLM/费用/新依赖。
- 数据/时间：仅PriceUSD / 1d，BTC和ETH是待确认试点候选；完整身份为Coin Metrics聚合美元参考价格，非交易所USDT现货。官方Price文档明确日期D表示UTC日终值，periodStart=D00:00，evidenceEnd=(D+1)00:00；原始日期保留。没有OHLC/volume，不补造成K线，不接90/180分钟模型。
- 版本/首次收到：同一固定Git commit，文件Git blob SHA1、实测SHA256和字节数并存；SHA1按Git blob前缀校验，非普通文件SHA1。真实接收时间由后续采集器记录，CSV日期不能回填成receivedAt/publishedAt。current_vintage，不声称PIT。
- 输入边界：纯函数接收CSV字节、固定文件manifest、显式日期范围、receivedAt、now；不请求网络、不自建时钟、不写DB或UI。最多4MiB单文件、10000数据行、256列、16KiB单行；仅两个官方路径对应的asset。UTF8严格、精确列数/time与PriceUSD各一列、合法UTC日期、严格递增/无重复；数值保留十进制原文并拒绝零/负/NaN/Infinity/溢出。其他指标不入输出。
- 区间：按sourceDate起点的[from,cutoff)，上限31个UTC日；只接受evidenceEnd<=cutoff且<=receivedAt/now的完成日。空PriceUSD、缺日期、目标外、未完成分别计数/标注，不插值、不判为0或完整。
- 输出：reference-price片段/覆盖、规范序列、源文件版本、来源/许可、实际收到时间；值仍是decimal string，不转换为实时Quote/Signal/HistoryPackage-v1。旧Store只准bar/information，后续需独立审查真实reference_price存储类型；本片不伪装成bar或macro。
- 允许路径：collector/coinmetrics-source.mjs、tests/coinmetrics-source.test.mjs、本卡/ACTIVE/主台账，以及忽略目录outputs/stage29-real-source。无schema、live算法、UI或生产变更。
- 测试：日终错位/跨月跨年闰日、半开窗口/未来末日、null与缺日、双源身份、decimal精度、乱序/重复、畸形CSV/UTF8、hash/大小/路径/版本错配；显式时间、输入不变、无网络。Node22/24专项；零产品集成改动不重跑build/browser，后续存储/展示片再扩大。

官方技术文档本轮新核对Price和API conventions；保存于临时mr29-cm-source-20261003，随后复制进忽略证据目录。归档版本f1a36afb962731c387bb03982758ab0103063da5；BTC文件2482497bytes/blob5e50f336d268e1f3a38e9885b5aaef36de529700，ETH2121732bytes/blobd8e4f389b37626f432a923805e5cc5fa2ad5490b；仅元数据，没有CSV下载。总约4.6MB大于此前Binance4MiB提案，该提案不沿用。

### CM-R2：真实采集和存储尚未进入

待资产确定后冻结独立日频批次：建议2026-09-01至2026-10-01（UTC日期半开，30日/资产），有限获取官方整个CSV但仅提取获准月份PriceUSD；完整文件成本计入预算，不能声称只下载60行。预计2份CSV合计4604229bytes，无订阅费；拟单文件4MiB、批次含重试16MiB/最多6次HTTP/最多2资产/60日值/120秒，持久消耗/检查点实施并审查后才执行。固定来源版本的LICENSE与README还须核对与已审条款一致。未批准实际资产前不执行真实下载，不通过更换runId重置预算。

公开展示会复用既有历史入口，需单独的日频reference契约/署名/不支持分钟研究提示；不会悄悄将日频当分钟。本轮尚未接入；原A/B分钟目标、长期保管和真实研究仍开放。必要schema方案定稿后再实施，不趁此改动生产数据库。

### CM-R1 本轮实现与新测

新增collector/coinmetrics-source.mjs、tests/coinmetrics-source.test.mjs。纯离线模块，不连接真实source准入/DB/网页，不增加网络请求/timer。固定版本LICENSE已实际读取并匹配Git blob f8f2af023ec95cb746dd08ec624c4c147b375af9，CC BY-NC4；该确认不自动批准其他API。

最终Node24与Node22.15各17/17 PASS（相同用例，不合计成34个独立场景）；两文件ESLint无诊断。旧history-foundation/fed-history初轮44项43PASS/1FAIL，失败为原CLI测试在旧工作树创建隔离fixture目录时EPERM；获准后仅重跑同一项1/1 PASS，未修改旧产品或测试断言。不能把初轮写成一次44/44成功。证据outputs/stage29-real-source/cm-20261003中的日志、commands、来源元数据。

独立GPT发现1项P2：commit正则隐式接受数组导致输出版本身份类型错误；已增加commit/blobSha显式字符串校验与反例测试。Auditor独立定点1/1通过，VERIFY PASS，无新增finding。其他所审日期/单位/缺口/decimal边界无confirmed finding。真实CSV兼容性/来源下载/DB/公开UI尚未测试。

本轮未运行build/typecheck/browser/full suite：新增模块尚无产品调用和TS/UI依赖，当前实际范围为离线解析；接入时必须运行相关集成。没有FPS/吞吐结论；无Optimizer，无DS实际调用。旧A/B/C核心未改，用户成果保留，不上传/发布。

## CM-R2 / CM-R3 — 已批准有限真实日频链路（2026-10-03）

用户对“首批BTC、ETH美元日频价格”明确回复“可以”；用途为已确认的免费非商业公开展示。该决定批准本地有限真实链路，不授权生产发布。此前“资产待答/价格0”保留为当时状态，下列为当前执行契约。

### PLAN / 数据与保存
- 固定批次 CM-SEP2026-001，2资产 btc/eth；sourceDate [2026-09-01,2026-10-01)，最多60值。不读取用户私有自选，不等于正式全部名单。固定Git commit与两文件manifest沿用CM-R1，LICENSE已验证；README补核后下载。每条记录保留USD/composite_reference/PriceUSD/1d、原日期及次日UTC00:00证据截止。
- 使用既有node:sqlite及localFile路径守卫。新增受限reference-price归档模块，独立本地数据库schema1，固定批次/许可/请求账本、文件版本、逐日reference事实分表；不修改ArchiveStore schema2，不向bar/information塞价格，不迁移任何旧库。独立事实家族与已有research journal相同边界，不引入数据库框架。
- 固定保存位置work/state27/coinmetrics-sep2026/archive.sqlite；原始文件/接收元数据在同批raw目录且不进入Git。此为本地持久保存；未落实项目外备份，不宣称长期保管完成。
- 当前批次只接受已批准固定commit；同文件重跑无新增事实，首次接收时间不回写。将来修订或新月份需新明确批次/契约，本片不通用化或自动接续。
- reconstructed/current_vintage；sourcePublishedAt unknown；不造observed_live/PIT、Quote、OHLCV、Signal或研究结果。日频方法明确unsupported。

### 预算 / 网络 / 中断
- CSV预计4604229bytes，单文件4MiB；最多6次HTTP，含失败最多16MiB预留消耗，2资产/60事实/120秒累计网络时长。无订阅/云费用；按每次4MiB保守预留，最多4次实际CSV尝试。超时/中断仍扣完整预留和30秒，不因崩溃/换runID/恢复重置。
- 先持久预留请求编号、字节/时间额度再请求；同固定本地DB继续，恢复目标默认禁采集。每HTTP一个reservation，串行，不自启重试/cron。429持久Retry-After（缺失保守24h）；403/401/重定向拒绝并停止，不换域绕过。
- 仅raw.githubusercontent.com/coinmetrics/data/<固定commit>/csv/{btc,eth}.csv，无任意URL；手动响应流/4MiB/30秒/拒绝redirect；先hash/严格CSV校验，事实+文件成功检查点同事务；中断最多留下已扣预算的无事实请求，再次显式执行可在额度内续跑。
- 正常查询只读，不启动网络。原始CSV可先落盘，只有同事务成功事实对外可见；失败文件不当已入库。Checksum不等于来源身份认证。

### 查询 / 备份 / UI
- 复用当前loopback工作台的Host/Origin/key/no-store边界，增加显式可选reference归档（只读快照会话）。只读有界日期查询，固定文件版本，最多31日/30事实；不传全CSV。
- 既有历史面板内新增默认折叠的日频参考价入口，BTC/ETH和UTC日期显式选择，失败保留已接受结果并标识其原资产/范围/版本；generation/abort防旧响应覆盖。旧分钟/fixture入口和实时资产/周期不改。
- 价格以原decimal string展示；来源链接、CC BY-NC4链接、转换说明、无担保及不支持分钟方法明示。不在UI另算金融状态。
- 本批备份为有界逻辑snapshot（最多1MiB/60事实/6请求/2源文件），consistent SQLite read transaction；独立schema/格式，不改变B大容量物理备份或旧浏览器包。SHA256校验+严格形状/范围/内容验证，恢复仅新空目标；保留预算与冷却、默认禁采集。无跨库一致性声称。

### 允许路径 / 测试 / 审计
- 新增collector/coinmetrics-archive.mjs、scripts/coinmetrics-history.mjs、tests/coinmetrics-archive.test.mjs、components/radar/reference-history.tsx及必要类型lib/history/reference.ts。
- 最小改scripts/history-workbench.mjs、components/radar/history-workspace.tsx、tests/history29-http.test.mjs、tests/browser/radar.mjs；必要CSS限现有历史区域。文档本卡/ACTIVE/唯一主台账/docs/HISTORY_STAGE_A.md/docs/API_CONTRACTS.md/docs/CURRENT_STATE.md；忽略outputs与work/state27。不修改live/Signal/State/提醒/认证业务或生产。
- 验证预算跨实例、失败/中断、同源hash/日期、幂等、SQL逐值身份、查询范围/版本、未来/不完整拒绝、备份篡改/新目标/恢复禁采集、关闭重开、新进程查询一致；fixture专项与真实集成分别记录。
- 真实下载后做同批二次执行（预期0网络/0新事实）、查询、导出、新库恢复、关闭重开、一致性核对；日频不适用分钟回放，明确NOT APPLICABLE，不降低旧算法门槛。
- UI接入后build/typecheck、受影响Node/lint、旧本地工作台和五视口浏览器回归，实际截图；新UI真机NOT RUN。GPT契约审查→Builder→稳定diff独立审计→findings修复/VERIFY。DS本片实际0（来源/权限/保存均GPT关键边界）；无测量瓶颈不Optimizer。
- 本批收口后停止，不扩大日期/资产。原分钟覆盖、长期保管与真实研究目标继续开放。

### CM-R2/R3 执行结论（2026-10-03）
用户批准BTC/ETH免费非商业日频试点后实际完成2请求/4604229bytes及本地原文件/版本/缺口保存。固定官方源仅到2026-05-24，**批准九月规范价格0/60日**；不是回补完成。原目标不改，已询问可否用现有五月文件另做离线试点，未答复前不执行。

独立reference SQLite、限额预留、只读查询/原历史UI、备份/新空恢复/重开与0请求重复运行完成；真实恢复对象是零覆盖账本，有值恢复使用fixture专项。完整记录/命令/限制见[Stage A追加报告](../docs/HISTORY_STAGE_A.md#2026-10-03-cm-r2--r3-有限真实批次与本地交付)。本轮341Node/340PASS/1既有WindowsSKIP、Node22专项25、build/typecheck/受影响lint、真实零覆盖6+模拟有值6浏览器条目通过。独立审计4P2已修VERIFY，最终UI无新finding，文档待终审。生产v29未改变；未push/tag/deploy，无DS调用/无持续采集/外部长期保管。

旧“未下载/资产待定”的段落为前序时点；本段与下方报告是当前状态。真实九月、分钟、完整2.9与长期保管仍开放。

### CM-R2/R3 最终证据终审
2026-10-03独立GPT history29_source_contract 对稳定12文件及报告/日志/真实receipt只读终审VERIFY，无新增confirmed finding。指纹c070f71198616b1df345197323b755404ad566db8ce7acb93323bd4f66ee68b3全部匹配；新测浏览器6真实零覆盖+6fixture有值+9旧分钟回归分别记录。协调者20个本地文档链接0损坏、git diff --check通过（仅既有CRLF提示）。本地临时查询与预览进程均已停止。五月范围仍待用户决定，未导入/未再采集，九月仍0/60；未上传部署，不宣布完整2.9完成。

## CM-MAY2026-OFFLINE-001 — 用户已批准五月独立试点（2026-10-03）

用户对“先用5月1–24日已下载数据完成真实展示、保留九月缺口、不新增请求/费用”回复ok。批准本地离线切片；不批准发布/其他月份/新来源。原9月0/60与原2请求消耗不回写。

### Planner定稿
- 输入只读已验证的9月原库与两份固定manifest原CSV；首个receivedAt保留2026-10-03实际值，再次核对SHA/Git blob和来源版本，不读私有自选或网络。
- 新批次固定BTC/ETH、USD/PriceUSD/1d、[2026-05-01,2026-05-25) UTC，最多48点。现有纯parser复用；日期天数/缺口检查从白名单固定profile计算，不能接受任意范围配置。
- 复用reference SQLite schema1/现有有界逻辑备份，无旧库迁移。新库work/state27/coinmetrics-may2026/archive.sqlite，通过内存构造+完整restore校验建新目标。原请求账本作为继承来源账本保留，status明确inherited/source batch与newRequests=0；不是再次请求，不重置预算。May配置永久禁止collector/reserve，不能拿此库恢复出新的采集额度。
- 每个May文件独立保存derivation：offline_reextract、实际derivedAt、parentBatch、parentSnapshot checksum、parentVersion。沿用真实源receivedAt与current_vintage/reconstructed；不造observed_live/PIT/Quote/OHLC。
- 先重算原9月片段核对原文件版本及收到时间，再解析五月；两个资产准备与校验都完成才产出新的快照。原库不写。重跑比较已有内容/lineage并复用首次derivedAt，0新增/0HTTP，不无声覆盖冲突目标。失败不出现半份可见批次。
- UI复用既有只读本地工作台，移除“/30”硬编码，使用domain expectedDates。展示离线提取时间与原取得时间区分；保持许可/unsupported分钟方法/默认折叠/返回周期。
- 允许路径：collector/coinmetrics-archive.mjs、scripts/coinmetrics-history.mjs、components/radar/reference-history.tsx、lib/history/reference.ts、tests/coinmetrics-archive.test.mjs、tests/browser/radar.mjs；现有任务/主台账/StageA报告/API/CURRENT_STATE与忽略证据目录。无新增依赖、框架、表、实时/State算法、服务或定时器。
- 验证：旧Sep备份向后兼容、May48点与日终边界、原价精度/接收时间/继承预算、无网络、伪造lineage/错日期/篡改原CSV/部分源/冲突目标、重复幂等、实际新空恢复+新进程重开、实际查询/UI五视口。受影响Node22/24、build/typecheck/lint；稳定阶段按共享archive模块风险全量Node一次。无需重跑未改变旧分钟浏览器全矩阵，引用上一轮9项为历史证据。
- 实际数据和fixture分开，至少一条真实值与原CSV独立核对。日频方法不支持原分钟回放/研究，仍NOT APPLICABLE；分钟目标/九月/长期保管继续开放。
- GPT主导实现及独立审计，DS本片无已派发任务，不把旧调用当参与。Optimizer无实测瓶颈则跳过；完成这一批即停止。尚未执行的结果不预写PASS。

### 五月执行与审计结果

Planner补充：按独立审核意见，parentEvidence保存有界父快照，并在恢复时交叉验证来源版本/实际receivedAt/继承请求；完整pending库关闭和fsync后独占发布到新目标。物理schema1不变，原九月备份兼容。

实际46/48：BTC/ETH各23，5月1–23日有值，5月24日源字段空；原九月0/60、旧库/backup/raw哈希不变。新增0请求/0网络字节，继承原2请求/4604229bytes。真实有值新空库恢复、新进程、逐价格对原CSV、幂等重跑均通过。29,997bytes新备份、本地57,344bytes库；外部保管未完成。

独立1P2空May备份校验已修，GPT内存复验VERIFY。Node22专项28/28及Node24专项11/11通过；build/typecheck/受影响lint、五视口真实历史6项通过；全量与最终证据补记见[Stage A](../docs/HISTORY_STAGE_A.md)。截图登录/实时行情仍fixture，生产/真机NOT RUN。候选fingerprint：1d0058a74da911cdcb826f7777acb8094cf1fa0301dde553202e07efaa201e12，12文件明细outputs/stage29-real-source/cm-may-20261003/candidate.json。

无DS实际调用，无有据瓶颈故跳过Optimizer。此切片本地交接；完整2.9、九月/分钟与长期保管仍开放，未上传/部署/采集调度。

五月最终证据终审：2026-10-03独立GPT只读VERIFIED，无新增finding，12文件指纹匹配；修复后全量344项343PASS/1既有WindowsSKIP。22本地链接0损坏、暂存为空；两个临时本地预览已停止。原九月与本轮未发布/长期保管未完成的边界保持。
