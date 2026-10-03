# 2.9 Stage A — 实际进度与来源决定

最新2026-10-03：五月真实日频46/48已本地查询/恢复验证，九月仍0/60；见末尾CM-MAY2026-OFFLINE-001。下方按执行先后保留原交接，“0条/待答”不代表五月当前状态。

2026-10-02；[主台账](../tasks/MR-29-REAL-DATA-WORKFLOW.md) / [阶段卡](../tasks/MR-29-A-REAL-DATA-PILOT.md)。**Stage A未完成。** 当前交付是有测试与独立审计的查询前置切片A-Q，真实价格0条。主分支31702c45/main CI37004484343 success为本轮读回的历史结果；本轮修改在独立分支codex/mr-29-a-real-data-pilot的未提交diff。现有生产Sites v29/source2ad04ee，本轮未上传/部署。

## 本轮实际完成

- ArchiveStore.query按显式原生5m/15m筛选；固定readRevision可在后续A/B/A修订入库后重现历史版本。旧缺省查询/旧游标兼容，跨周期/owner/source/asset/版本游标拒绝。
- 导出透传周期和版本，仍fixture-only的history-package-v1；混周期旧请求继续报错，不悄悄挑选一组。
- 单查询≤200行/31天、包≤2000bar/2MiB和既有来源校验不变。未新增HTTP服务、schema、adapter、金融算法或浏览器入口。
- 合成数据跨进程关闭→导出恢复至新空目标→再开进程查询/回放/研究，输出严格相等；恢复不启用采集。240根fixture研究为样本不足，证明恢复等价，不声称可用真实研究。

## 官方来源核查

仅文档读取，共10次请求尝试，6份正文200；最初两份条款跳转被redirect:error拒绝，经manual確認为官方302/308，再读取其指向及官方附加条款链接。无行情请求/账号登录/购买/第三方转载依据。原始正文和时间/hash在本地忽略目录outputs/stage29/sources，正文不随仓库公开。

| 官方资料 | 本轮证据 / 对本任务影响 |
| --- | --- |
| [OKX history-candles](https://www.okx.com/docs-v5/en/#order-book-trading-market-data-get-candlesticks-history) | 2026-10-02T12:29:01Z取到规范。原生5m/15m、毫秒开盘、max300、after更早/before更晚、IP20次/2秒；confirm 0未完成/1完成。spot成交量基础币/报价币与合约张数必须区分。端点实际排序/边界/资产上市范围尚未实测 |
| [OKX API Agreement](https://www.okx.com/en-us/help/okx-api-agreement) | 12:37:08Z取得，页面Last Updated28July2026。9.4第三方publish/display/redistribution须书面同意，公共端点同样适用；也限制竞争分析平台和超个人合理规模抓取。保存/研究/对外展示的本账户适用授权尚无证据，不能以访问码或公共端点放行 |
| [Massive个人价格](https://massive.com/pricing) | 12:29:03Z取得；Basic挂牌$0、5calls/min、2年历史、EOD/分钟聚合；Starter$29/月、5年历史/15分钟延迟。不是90天真实样例、专项许可报价、账户地域资格或采购授权 |
| [个人服务条款](https://massive.com/legal/individuals-terms-of-service) / [Market Data附加条款](https://massive.com/legal/market-data-terms-of-service) | 12:37:43Z/12:38:18Z取得。数据默认display-only；non-display/derived用途需许可，第三方数据与衍生图表/研究输出转交受限。仅购买个人套餐不证明本项目回放/研究和网站展示可用；不推荐先买后补权限 |

其他既有Yahoo历史权利未知、FED只批准宏观元数据的边界保持。没有获准价格源便不打价格端点；checksum证明包完整性，不证明许可。真实清单仅可由用户明确列表/已有本机材料取得；不扫描私有浏览器或使用默认自选替代。

## 最小外部决定

一次集中问题已发出，等待正式代码/本机清单路径、已有数据供应商及保存/私人研究/展示/导出许可范围、需付费时的上限。不重复索要已安排本地目录。

| 缺项 | 推荐 / 取舍 | 阻塞 |
| --- | --- | --- |
| 正式集合与必要基准 | 从正式集合选5–10代表资产，按可用性/质量选，不按研究结果选 | 冻结universe和逐资产覆盖 |
| 来源许可/使用范围 | 优先已有获准供应商；无则需包含non-display研究/保存的明确授权，第三方展示单独核验。OKX和Massive均非现在可直接开跑的批准源 | 真实source注册、采集、正常网页真实查询、恢复和研究实测 |
| 实际预算/批次批准 | 专项许可未取得报价，不购买。阶段卡已有按5–11条5m序列的资源估算与建议硬上限，仍须批准并实现累计账本 | 真实批量执行，不能靠runId轮换绕限额 |

建议A本地路径work/state27/stage29，现有库不动，恢复用新的空目标。data/local仍预留。异地备份/期限和更早日/小时/全年分钟属于B条件，不把本轮临时fixture恢复称长期保管。

## 本轮验证（非历史复用）

| 执行 | 结果 / 证据 |
| --- | --- |
| Node24.19.0：`node --experimental-strip-types --import ./tests/register-types.mjs --test tests/history29-query.test.mjs` | 7/7；outputs/stage29/query-tests.log |
| `node node_modules/vinext/dist/cli.js build`；`node scripts/typecheck.mjs` | PASS；build.log/typecheck.log；Windows分项入口，不宣称运行了Bash npm test包装器 |
| Node24：`node --experimental-strip-types --import ./tests/register-types.mjs --test tests/*.test.mjs` | 295项/294PASS/0FAIL/1SKIP；node-tests.log。SKIP为既有Windows文件symlink权限不足；目录junction覆盖通过 |
| Node22.15.0：同loader运行history29-query/history28/history-foundation/fed-history/p0-verification五文件 | 67项/66PASS/0FAIL/1同项SKIP；node22-archive.log。不是本轮UbuntuCI |
| ESLint store/history-package/history29-query三文件；git diff --check | PASS；lint.log；不冒称全仓lint clean |
| 既有tests/browser/radar.mjs，RADAR_HISTORY28_ONLY=1、RADAR_SYNTHETIC_AUTH=1 | Edge149.0.4022.98，本地workerd production build，loopback5294，外网禁用。12检查PASS，五视口1440×1000/768×1024/390×844/320×740/844×390，system/normal/reduced；新旧合法示例、失败保留、分页、焦点、触控、无溢出。outputs/stage29/browser/verification.json及截图；errors=[]、warnings=[] |
| 本轮CI/生产/真机 | NOT RUN；无push授权。旧main CI只用于基线核对。本地合成认证和行情不等于生产登录验收 |

浏览器暂停polling下的历史查询请求增量0仅为隔离fixture检查；未测真实供应商吞吐、90天库容量或新HTTP服务，不宣称更快/FPS提升。主生产前端未改；无证据进入Optimizer。

## DS / 审计与下一步

DS实际1次成功调用：CLI0.155.0-alpha.16.4、deepseek-flash/provider deepseek、read-only/never、独立worktree market-radar-stage29-ds；仅发送固定查询契约的脱敏文字，无文件读取/工具/写入。返回测试清单，GPT采纳周期隔离、版本边界、旧游标和恢复等价检查，确认含界上限及错误语义。配置model metadata刷新警告保留；不把配置存在当实际测试。前置worktree创建因运行用户所有权失败一次，在正常工作区身份下完成后才调用DS；非外发拒绝，无换Provider重试。

独立GPT stage29_query_audit对稳定产品diff只读审计，无产品confirmed finding。证据复核发现1项LOW：主台账仍把已完成的查询参数列为缺口；已同步代码/验证事实并区分基线时描述，Auditor定点VERIFY PASS，无未解决finding。其提醒的240根恢复测试仅样本不足亦已明确。审计核对日志/浏览器JSON及两候选官方条款，不声称重跑全套或生产实测，没有用主代理自检冒充独立审计。

下一步仅在对应条件到齐后：注册获准真实源/序列和累计预算 → 单资产/必要基准小试跑 → 冻结集合有限接续 → 新空库真实恢复 → 本地受控网页查询 → 真实回放/冻结协议研究。数量不足可如实交研究执行账本；未接入不能称研究完成。阶段A保持开放，不自动进入B/C。

## 2026-10-03 接续：公开历史用途已澄清

用户明确“需要公开网站展示，先核实相应许可”；未采用个人本地研究试点。新调查与待定路线见[真实源核查卡](../tasks/MR-29-A-REAL-SOURCE-READINESS.md)：Coin Metrics官方日频归档CC BY-NC4允许有条件非商业公开分享，不能替代原生分钟；CoinPaprika原生5m/15m OHLC及数据分享列Enterprise专属合同，普通套餐不解决该组合需求。Binance个人研究许可未被当作本网站展示授权。Coinbase/CoinGecko正文受403验证阻挡，未绕过。当前仍未下载价格，无产品改动或新产品测试，旧A/B/C证据保持原日期。

## 2026-10-03 CM-R2 / R3 有限真实批次与本地交付

**当前结论：实现与本地验证已推进；九月真实价格交付未完成。** 用户已确认免费非商业用途及首批BTC/ETH USD日频。固定版本官方文件实际仅到2026-05-24，不能用五月填九月或调整目标后宣称回补成功。已集中询问是否允许用已下载文件的2026-05-01至05-24另做有限离线试点；没有答复前不导入该范围、不增加请求。

### 对象、身份与实际覆盖

- 源码：codex/mr-29-c-research-workflow / HEAD31702c45；A/B/C/R1原未提交成果保留。本轮新增R2/R3也未提交。本轮未重新查远端CI或生产。
- 实际批次CM-SEP2026-001，sourceDate [2026-09-01,2026-10-01) UTC；日终证据截止为次日00:00。来源固定Coin Metrics commit f1a36afb962731c387bb03982758ab0103063da5，LICENSE与README均验证Git blob且数据明确CC BY-NC4；仅适用本免费非商业来源归档用途。
- BTC原文件2482497bytes，6351日期行，2009-01-03至2026-05-24；ETH2121732bytes，3952日期行，2015-07-30至2026-05-24。这是**原文件范围**，不是已批准范围事实入库或长期完整率。
- 九月BTC 0/30、ETH 0/30，60日均missing_date；源文件处理成功不等于价格回补成功。已批准九月规范价格事实0；原始文件与版本/缺口凭证已真实保存。
- 2次HTTP、4604229响应体bytes（不含TLS/协议头），两次成功；实际时间来自请求账本。保守预留8388608bytes/60000ms，其中未用预留不返还；批次有效最多4次尝试（16MiB/120秒先于6请求上限触发）。无购买/订阅/云资源收费；本机磁盘/网络账单金额未测。
- 只保存USD/PriceUSD/1d/composite_reference，reconstructed/current_vintage；无OHLCV、USDT转换、observed_live、PIT或研究成绩。日频不适用既有分钟模型，原A/B分钟覆盖和真实研究继续开放。

### 实现与保存

collector/coinmetrics-archive.mjs + scripts/coinmetrics-history.mjs：独立node:sqlite reference家族schema1，逐日事实/固定源版本/请求预留账本分表，不改ArchiveStore2或旧FED/fixture格式。受控固定CLI只能选CM_PILOT，不接受库内fixture配置作为真实来源；请求上限与冷却跨进程保存，不用runId清空预算。失败后显式续跑，无自动retry/cron。

文件先写受控pending、fsync再rename；事实和成功checkpoint同事务。HTTP拒绝/429先持久化再清理响应，清理异常不能抹掉源停止状态。固定来源hash/严格CSV验证；未知内容拒绝。临时失败文件保留供人工检查，最多在本批预算范围；没有后台清理或无限增长采集。

- 原库：work/state27/coinmetrics-sep2026/archive.sqlite
- 原始文件与接收receipt：同目录raw/（Git忽略）
- 本批逻辑备份：backup-sep-empty-v1.json，8207bytes
- 新空恢复库：restore-check/archive.sqlite，恢复默认禁采集
- 证据：outputs/stage29-real-source/cm-20261003/real-integration.json、real-repeat.json

真实重复执行已完成，0新请求/0新事实；按原资产查询、导出、新空库恢复、关闭重开后固定内容相同。**实际恢复的是来源/请求/零覆盖账本，没有九月有效价格可恢复**；有值恢复和新进程一致性另由fixture专项验证，不混为真实有值验收。恢复保留消耗/冷却、清旧reserved执行权，不会启动采集。

这里只是本机项目内持久化和本地备份；项目外/异地位置、保留期限及负责人仍未落实，长期保管NOT COMPLETE。原CSV不是浏览器传输包，也没有作为原生分钟或历史当时可知数据使用。

### UI与接口

复用scripts/history-workbench.mjs和既有历史面板。可选reference-only只读固定SQLite会话；没有分钟快照时明确拒绝旧研究/登记路由，不创建模拟研究库充数。catalog附reference目录，POST reference-query严格通过原Host/Origin/key/no-store门禁；请求不能指定库路径/owner/源URL或启动下载。一次只查同一文件版本/批准日期，最多30点，原小数直接展示。

新components/radar/reference-history.tsx默认折叠；BTC/ETH、UTC半开日期、实际取得时间/版本、缺口/日频方法不支持、来源/许可和转换说明清楚分层。失败保留原查询身份，改变输入与旧响应不冒充新请求成功。旧分钟文件导入/研究保留，与实时snapshot/selected/手动周期和提醒不互写。局部修正历史表单按钮最小44px，其余UI风格/动效不改。

### 本轮新测（Windows / Node24.19.0、最低Node22.15.0）

| 范围 | 实际结果 |
| --- | --- |
| node --test tests/coinmetrics-archive.test.mjs | 最终8/8；模拟网络，预算/中断/幂等/429/403/302清理异常、恢复、未来/超时/错身份、查询边界；最初SQL占位符和返回对象原型差异已修，不改测试要求 |
| Node22.15：coinmetrics-source + coinmetrics-archive | 25/25；与Node24重叠用例，不求和成独立场景。node22-r2.log |
| Node24全量：node --experimental-strip-types --import ./tests/register-types.mjs --test tests/*.test.mjs | 341项：340PASS/0FAIL/1SKIP；node-all.log。SKIP为既有Windows file symlink权限不足，目录junction仍覆盖。不是远端CI |
| node node_modules/vinext/dist/cli.js build | PASS；build.log。既有>500KB chunk警告仍有，无本轮性能提速声明 |
| node scripts/typecheck.mjs | PASS，工具输出记录。首次普通权限因旧工作树生成文件EPERM失败；获准原路径写入后重跑通过。分项入口，不称执行了npm test Bash包装器 |
| 受影响9个JS/TS/TSX文件ESLint | PASS、0诊断；不代表全仓lint-clean |
| tests/browser/radar.mjs / RADAR_REFERENCE_ONLY=1 | Edge149.0.4022.98本地生产构建：真实零覆盖6项PASS；browser/verification.json，五视口截图。fixture有值/极小长小数6项PASS另存browser-fixture/，不计真实覆盖。两次各1条503 console error来自主动失败测试，pageerror为空 |
| 旧分钟浏览器回归 | 最终9/9 PASS，browser-regression/verification.json；五视口+system/normal/reduced，含旧请求取消/错误保留/登记/手动pending。首轮复用10月2日fixture导致前瞻结果期限已过，原规则拒绝登记；新同规模/方法显式时间fixture复测通过，原因和生成范围在regression-fixture.json；未修改产品规则或放宽断言。1条503为主动失败测试，pageerror为空 |
| 生产/新UI真机/当前CI/公开部署 | NOT RUN。现有生产仍2.8 Foundation P0 / Sites v29；本轮未重新发布 |

五视口为1440×1000、768×1024、390×844、320×740、844×390，独立Edge桌面模拟。已实际查看mobile/desktop截图；无横向溢出、默认折叠、许可可访问、返回保留1周手动周期。首轮新按钮44px断言失败后局部修正，构建/五视口重测通过。不同数据身份的截图不冒充同数据前后性能对比。

### 审计、分工、剩余范围

GPT history29_source_contract 独立PLAN VERIFY后审核心发现4P2：清理异常丢源状态、直接写最终raw不能从部分文件续跑、恢复未约束超时/未来时间、真实CLI接受fixtureprofile。均已修并VERIFY；独立内存5反例通过。原文件写入中断与磁盘满的真实文件系统故障注入NOT RUN，静态路径与模拟写入失败测试不等于真实断电演练。

最终UI/真实零覆盖/只读接口独立只读复核无新增confirmed finding；核对真实receipt及桌面/320px截图，无新网络或独立全量测试。文档终审在末尾补记。DS本片实际0；来源/预算/权限/恢复为GPT关键边界，没有把历史DS调用算成本轮参与。Optimizer跳过，无测量瓶颈证据。

本批不扩大年月/资产，未上传、部署、购买、迁移生产或启用后台。下一步待五月离线试点范围决定；九月另需来源更新或新获准来源，不能靠同文件重试解决。分钟许可/更早分层覆盖/正式全名单/外部长期保管/真实研究均仍开放，不能宣布2.9完成。

### 操作手册（仅配置名，无真实密钥）
在本项目根使用Node>=22.15，所有数据名由localFile限制在work/state27：
- node scripts/coinmetrics-history.mjs status / query btc / query eth：查看固定批次和缺口。
- collect：仅在预算内显式执行；本批两文件已处理，重跑不下载，不启动常驻服务。
- backup <新相对文件名>；restore <备份相对文件名> <新目标相对DB名>：有界备份/新库恢复，绝不覆盖已有目标，恢复禁采集。
- 本地只读工作台：先启动现有隔离预览，安全设置RADAR_ARCHIVE_TOKEN；node --experimental-strip-types --import ./scripts/register-types.mjs scripts/history-workbench.mjs - - - http://127.0.0.1:<预览端口> <本地工作台端口> coinmetrics-sep2026/restore-check/archive.sqlite。令牌只在浏览器内存，不用网站访问码代替；20分钟自动退出，可Ctrl+C停止。
- 不能将本地工作台部署到公网；当前没有生产归档路由或持续服务。更换已批准范围前先定新批次，不手工改DB清预算；本轮五月方案未获答复，不执行。

### CM-R2/R3 最终证据终审
2026-10-03独立GPT history29_source_contract 对稳定12文件及报告/日志/真实receipt只读终审VERIFY，无新增confirmed finding。指纹c070f71198616b1df345197323b755404ad566db8ce7acb93323bd4f66ee68b3全部匹配；新测浏览器6真实零覆盖+6fixture有值+9旧分钟回归分别记录。协调者20个本地文档链接0损坏、git diff --check通过（仅既有CRLF提示）。本地临时查询与预览进程均已停止。五月范围仍待用户决定，未导入/未再采集，九月仍0/60；未上传部署，不宣布完整2.9完成。


## 2026-10-03 CM-MAY2026-OFFLINE-001 — 真实五月离线交付

用户明确批准已下载BTC/ETH文件的5月1–24日独立试点；原九月0/60及原请求账本保留，不是缩减九月目标。上述“五月待答/真实价格0”为此前记录。当前基线仍codex/mr-29-c-research-workflow / HEAD31702c45c653e5e33bac258c110f159d432d5b87，原A/B/C未提交成果保留；本轮未重新核验远端CI或线上产品。

### 真实覆盖与来源身份

| 序列 | 批准sourceDate半开范围（UTC） | 有值范围/数量 | 缺口 |
| --- | --- | --- | --- |
| Coin Metrics BTC / USD / PriceUSD / 1d | [2026-05-01,2026-05-25) | 5月1–23日，23/24 | 5月24日有日期行、PriceUSD空：missing_value |
| Coin Metrics ETH / USD / PriceUSD / 1d | 同上 | 5月1–23日，23/24 | 同上 |
| 原CM-SEP2026-001 BTC/ETH | [2026-09-01,2026-10-01) | 0/60，未变 | 原固定源文件无该月份，missing_date |

沿用Coin Metrics官方固定commit f1a36afb962731c387bb03982758ab0103063da5及已核对CC BY-NC4归档许可，仅免费非商业用途并展示署名/许可/转换与无担保说明。不是其他API的广泛许可。46个decimal原文已逐项与原CSV核对。BTC首尾78132.6437852133 / 76619.8666090415；ETH首尾2292.81031618936 / 2116.16834102864。不是OHLC、USDT或交易所分钟K线。

每个来源日期的证据截止仍为次日UTC00:00。原receivedAt分别为2026-10-03T03:20:58.329Z、03:20:59.582Z；本次derivedAt独立记录为2026-10-03T03:57:05.912Z。身份reconstructed/current_vintage，来源公开时间unknown，不能据此宣称五月当时已观察/PIT/真实预测。

### 保存、幂等与恢复

- 原九月DB、8207bytes备份和两份原CSV的SHA256前后完全一致；五月新库work/state27/coinmetrics-may2026/archive.sqlite，57344bytes，独立固定profile，复用schema1，未迁移旧库。
- 每个文件保存原来源provenance及offline_reextract、derivedAt、parentBatch/parentVersion/parentSnapshot/有界parentEvidence。恢复无需旁边存在旧库，仍能验证继承来源账本。hash只保证内容完整性，不是签名或第三方身份认证。
- 原2请求/4604229bytes记为inherited_from_CM-SEP2026-001，保留预留预算/冷却；本次newRequests=0、newNetworkBytes=0、无新增收费。May永远不能reserve/collect，不因恢复变出新额度。
- 新库先内存完整校验，再写唯一pending库、关闭SQLite、fsync、独占link发布新目标；绝不覆盖原目标，失败仅清本次pending。Node22与Windows兼容已测。实际断电/磁盘满注入NOT RUN，不声称exactly-once。
- 第二次extract-may复用首次derivedAt并核对完整快照，reused=true、无新增数据/请求。backup-may-v1.json为29997bytes，恢复到新空restore-check/archive.sqlite，BTC/ETH查询逐对象相等；关闭后新进程读取相同。
- 审计修复后再次恢复至新空restore-audit-fix/archive.sqlite：仍46点、原账本/禁采集、逐查询相等，旧父文件hash未变。证据real-integration.json及post-audit-real-restore.json。
- 库/raw/备份均在项目忽略目录，不进入Git。项目外备份、期限/容量/负责人未落实，**长期保管仍未完成**；没有持续服务或云资源。

### UI与本轮验证

默认折叠的日频面板沿用本地只读工作台；覆盖分母来自domain expectedDates，实际显示23/24。原收到时间与离线提取时间分别显示，保留许可、缺口、当前版本和不支持分钟方法的说明。异步旧响应/失败保留原身份，返回实时保持手动周期；实时数据和提醒未变。

证据根：outputs/stage29-real-source/cm-may-20261003/。

| 本轮命令/环境 | 实际结果与边界 |
| --- | --- |
| node --test tests/coinmetrics-archive.test.mjs | 最终11/11 PASS；新增3个May用例，含48点fixture、原值/时间/账本/身份、禁采集、删空/删单文件等篡改拒绝；不是实际48点 |
| Node22.15 --test tests/coinmetrics-source.test.mjs tests/coinmetrics-archive.test.mjs | 审计修复后28/28 PASS，node22-audit-fix.log；与Node24重复场景，不求和 |
| node --experimental-strip-types --import ./tests/register-types.mjs --test tests/*.test.mjs | 修复前344项343PASS/0FAIL/1既有Windows文件symlink权限SKIP；审计修复后再次344项343PASS/0FAIL/同1SKIP，node-all-audit-fix.log；不是独立场景翻倍 |
| node node_modules/vinext/dist/cli.js build | PASS，build.log；既有>500KB chunk警告保留，无性能提速声明 |
| node scripts/typecheck.mjs | PASS，typecheck.log；实际分项运行，不冒称执行npm test包装脚本 |
| 6个涉及JS/TS/TSX文件ESLint | 0诊断；审计修复后2个文件再测0诊断，lint-audit-fix.log；不是全仓lint-clean |
| RADAR_REFERENCE_ONLY=1 / RADAR_REFERENCE_EXPECTED=23 / RADAR_REFERENCE_DAYS=24 / RADAR_SYNTHETIC_AUTH=1：tests/browser/radar.mjs | Edge149.0.4022.98、本地生产构建；五视口共6条检查PASS。真实May历史；登录/实时行情为fixture，故障503为主动注入；pageerror=[]，console保留该1条503。browser/verification.json与截图 |
| 五视口 | 1440×1000、768×1024、390×844、320×740、844×390。桌面模拟，不是真机；实际查看mobile/desktop截图，23行/缺口/许可、键盘44px、无横溢出、返回手动1周、慢响应及错误保留通过 |
| 旧分钟浏览器9项 | 引用前轮CM-R2历史证据，本轮NOT RUN；本片不改分钟UI/算法。修复仅本地restore入口，不影响已构建浏览器资产；未机械重跑build/browser |
| 生产/远端CI/iPhone Safari/真实断电 | 本轮NOT RUN。生产记录仍2.8 Foundation P0 / Sites v29；本轮未重新发布 |

首次fixture恢复专项测试的Windows只读句柄fsync返回EPERM，改为r+后复验通过；首次审计修复置于通用validate导致临时空库构造失败，移到恢复入口并重测通过。保留失败事实，不降低断言。

### 独立审计与阶段边界

GPT history29_source_contract只读PLAN审查要求原子新目标发布与可独立恢复的父证据，均纳入实现。稳定核心审计1个P2：删空May文件/点/请求后可重算checksum绕过逐文件lineage。现恢复入口必须恰有BTC与ETH两份来源记录；允许价格缺口。全删/单文件反例拒绝，Auditor独立内存复验实际46点备份可恢复，VERIFY无新增finding。最终文档与证据已由同一独立GPT只读终审VERIFIED，无新增finding；不把主代理自检当独立审计。

DS本片实际调用0。Optimizer跳过，无测量瓶颈，不宣称FPS改善。真实日频链路已打通，**2.9整体未完成**：原生分钟获准来源、九月及更早分层覆盖、正式全名单、外部长期保管、真实分钟回放/研究与成熟结果仍开放。日频原方法不适用，不用46个日值拼分钟研究。

### 五月本地操作（不含令牌）

项目根、Node>=22.15：
- node scripts/coinmetrics-history.mjs extract-may：固定已批准范围的离线重提/幂等核对，无网络。
- may-status / may-query btc / may-query eth：查看五月状态、覆盖、原decimal与时间；命令前缀同上。
- may-backup <新相对文件名>；restore <备份相对文件名> <新目标相对DB名>：1MiB有界备份，保留账本、禁止采集，不覆盖目标。
- 延用上方安全loopback启动说明，把最后reference参数设coinmetrics-may2026/restore-check/archive.sqlite；网站访问码不代替本地会话key。只限本地查询，20分钟自动退出/可手动停止。

未push/merge/tag/deploy、购买、远程写入或启用调度；本批交接即停止，下一批另领范围。


### 五月最终候选与协调者检查
2026-10-03：候选12文件指纹1d0058a74da911cdcb826f7777acb8094cf1fa0301dde553202e07efaa201e12，明细candidate.json。修复后全量Node344项343PASS/1既有Windows权限SKIP；Node22专项28/28，真实新空恢复46点与原对象一致。git diff --check通过（仅既有CRLF提示）、暂存为空，其他原A/B/C成果保留。本批两个临时loopback预览进程已主动停止，未留常驻采集。独立GPT history29_source_contract最终只读终审VERIFIED：12文件哈希/候选指纹一致，46/48与0/60、来源/收到及派生时间、继承与新增消耗、真实/fixture/历史证据、未发布与剩余目标均核对一致；本次审计没有写入/联网/重跑全量/生产/真机/断电测试。22个文档本地链接0损坏。

### 2026-10-03 上传前九月来源更新复核
用户追问九月为什么持续为0。本轮通过官方GitHub commits API分别查询csv/btc.csv、csv/eth.csv最新记录，两者仍为f1a36afb962731c387bb03982758ab0103063da5，提交时间2026-05-24T13:37:39Z；与本机已验证原文件版本一致。此档案没有新增九月记录，不是只因本机锁了旧版本；重复同文件不能补缺。该核对仅2次元数据读取，未重新下载CSV/未新增真实采集批次；不推断其他Coin Metrics API或商业产品没有九月数据。公开展示所需的新来源/用途核查仍待后续，不能改原目标或用五月值替代。上传状态见[上传归档](../tasks/archive/MR-UPLOAD-HISTORY29.md)；本轮不部署。

### 上传交接
本地候选源码5a06c46已普通上传GitHub独立分支及[草稿PR #2](https://github.com/cjwdwb/market-radar/pull/2)，首轮Ubuntu24.04.5/Node22.15完整构建、类型及Node344/344通过。后续仅parser末尾1空行整理（专项17/17新测）和上传文档；各commit的CI分开核对。上传记录[tasks/archive/MR-UPLOAD-HISTORY29](../tasks/archive/MR-UPLOAD-HISTORY29.md)。原CSV/DB/备份未上传，网站未部署，本报告原“本地未上传”为当时状态。

## CM-API-SEP2026-002 — 九月缺口解决（2026-10-03，本地未发布）

任务[MR-29-SEPTEMBER-GAP](../tasks/archive/MR-29-SEPTEMBER-GAP.md)，源码基线073adc3d1f47a1db1647a1f689629b4998f55196，分支codex/mr-29-september-gap。本轮实际取得BTC/ETH各30条2026-09-01至09-30的USD日终参考价；旧CSV停更造成的零覆盖通过官方Community API新批次解决，旧库未覆写。**这不是2.9分钟研究或所有长期目标完成。**

### 来源、用途与日期

- [官方Community产品](https://gitbook-docs.coinmetrics.io/packages/coin-metrics-community-data)：明确免费Community Metrics及[CC BY-NC4](https://creativecommons.org/licenses/by-nc/4.0/)。本项目已获用户确认免费、非商业公开展示；保留署名、许可、筛选/日期转换说明及无担保。并非所有付费API的广泛展示授权。
- 官方SDK [test_base_url固定版本](https://github.com/coinmetrics/api-client-python/blob/5f3752667b14c3bebec5b335641dddf12373b845/test/test_api_client.py)明确无key使用community-api.coinmetrics.io/v4，带key才用api.coinmetrics.io/v4。主域首次试读401后停止；随后基于这项官方独立产品证据才使用免密入口，不轮换身份/绕过拒绝。
- [Timeseries契约](https://gitbook-docs.coinmetrics.io/api-reference/timeseries/timeseries-rest/asset-metrics)、[PriceUSD语义](https://gitbook-docs.coinmetrics.io/network-data/network-data-overview/market/price)：固定PriceUSD/1d，UTC源日期D对应日终D+1 00:00；保存原十进制，不伪造OHLC、USDT、实时观察或分钟输入。
- 官方Master Terms（2025-01-06）§1.1–1.2/§3.1及定义针对双方Order Form服务；未见撤销另行明确的Community许可。仅按免费产品许可使用，未购买/使用PRO。PDF SHA256 0fed9b4dbd7fd8e4282b72bccd35404b99b80ecba50762f9ce176c05a45ae877；独立GPT只读复核一致。
- 许可/官方文档及试读证据在outputs/september-gap/，不是把第三方教程当许可。P2返回ratePlan=download原样留证，不据该头声称付费权限。
- 身份reconstructed/current_vintage；sourcePublishedAt=null、publicationPrecision=unknown；实际收到时间为2026-10-03，不能称九月当时已观察/PIT/过去预测。SHA只证明本地内容一致，不是来源签名。

### 实际覆盖与消耗

目标sourceDate为[2026-09-01,2026-10-01) UTC；60个日期格逐项与原API响应核对。

| 来源/序列 | 实际有值日期 | 数量/缺口 | 固定读取版本 |
| --- | --- | --- | --- |
| Coin Metrics / BTC / USD / PriceUSD / 1d | 9月1–30日 | 30/30，0缺日/空值 | 0cb5034eeb6ae74a2c11d8732a9f5f85c2313603818f89ef24636d3f2f15a1cc |
| Coin Metrics / ETH / USD / PriceUSD / 1d | 9月1–30日 | 30/30，0缺日/空值 | efeef0b1680f7ce251f92a970d6ccfdbe84a6ecb80251b8cc2887c7b6e22ac1a |
| 原CSV CM-SEP2026-001 | 原响应仍只到五月 | 原0/60记录保持，作为旧来源失败证据 | 原库hash不变 |
| CM-MAY2026-OFFLINE-001 | 5月1–23日 | 原46/48不变 | 原库hash不变 |

首尾BTC为77407.7011547107 / 83579.6739176914；ETH为2418.34781267095 / 2686.06343545295。API原文逐值一致。date_grid_present只证明该批30日期均取得值，不代表来源价格准确率、全市场覆盖或OHLC完整。

采集正常2次HTTP、响应体2589+2582=5171 bytes；实际receivedAt分别05:06:46.500Z / 05:06:46.839Z。来源能力试读另计2次/270 bytes（含主域401/88bytes、免费入口200/182bytes），未把试读混入批次或擦除失败。官方资料读取另计，详见输出metadata；网络传输总账单未测，不把响应体字节当TLS/头/重传总量。本批免费，无采购或付费资源开通。

批次硬约束：仅两资产/固定30日，每资产固定单页page_size100；不跟任意next URL，存在后页则拒绝而不假称完整。4次尝试持久上限、每次30s、每次成功体128KiB、批次运行120s；预留最多512KiB。串行且BEGIN IMMEDIATE内记录至少1秒源冷却，跨次运行/崩溃不重置预算。无自动重试；401/403/重定向停用，429保留Retry-After冷却。仅手动有限续跑，无cron。

128KiB是解码响应的接收/准入门槛，流式读取可能在交付一个超限chunk后才检测；失败账本如实保留已交付字节，不把它截断为预留值，不能宣称线路实际字节绝不超限。未读取的拒绝响应体、传输头和内部网络开销不计入该观测值。

### 持久化、恢复与界面

复用现有CoinMetricsArchive物理schema1和有界snapshot格式；新增严格API profile及provenance，不给API响应伪造Git commit。CSV/May兼容与原导出语义保持。每次raw按requestId/asset/SHA唯一保存并flush，随后同一事务写事实/accepted checkpoint；失败留下消耗、不会公开半提交事实。重跑成功资产跳过，实测新增0请求。

真实库work/state27/coinmetrics-api-sep2026/archive.sqlite为32768bytes；raw/receipt分别保存。backup-v1.json为10775bytes；新空restore-check与审计修复后的restore-final均60值，源/版本/价格/时间/覆盖逐对象相同。关闭后独立Node22进程再次查询相同。恢复禁采集且保留预算、冷却；不覆盖原库。真实断电/磁盘满NOT RUN，相关失败机制只用隔离测试验证。

日频查询沿用现有手动loopback工作台，通过只读固定版本查询，页面默认折叠；来源显示Community API和响应hash，署名链接指向官方产品。查询覆盖分母来自domain，BTC/ETH均显示30/30。失败保留旧结果的资产/日期/版本身份；过期异步响应不覆盖新资产，返回实时保留手动周期。没有新增生产API、行情请求、供应商symbol、timer或研究模型。

数据/原响应/备份都在项目忽略目录，尚无项目外长期备份；本地恢复成功不等于长期保管完成。没有公开网站部署，本机文件不会因上传代码自动上线。

### 本轮验证与独立审计

证据根outputs/september-gap/。历史344/344远端CI未当作本轮结果。

| 检查/实际入口 | 结果 |
| --- | --- |
| Node24目标tests/coinmetrics-{source,archive,api}.test.mjs + tests/history29-http.test.mjs | 修复前38/38 PASS；修复后受影响API/archive 20/20 PASS |
| Node22.15同四个文件 | 最终39/39 PASS，node22-verified.log；SQLite/类型剥离实验提示保留 |
| node --experimental-strip-types --import ./tests/register-types.mjs --test tests/*.test.mjs | 最终353项：352 PASS/0 FAIL/1 SKIP（Windows文件symlink权限不可用，目录junction另有通过），node-all-verified.log |
| node node_modules/vinext/dist/cli.js build | PASS，build.log；既有>500KB chunk warning未掩盖，无FPS/性能改善声明 |
| node scripts/typecheck.mjs | PASS，typecheck.log。Windows实际分项运行，未声称运行npm test包装 |
| 6个涉及JS/TS/TSX文件ESLint | 修复前后均0诊断，不冒称全仓lint |
| 本地生产构建 + RADAR_REFERENCE_ONLY=1 / EXPECTED=30 / DAYS=30 / SYNTHETIC_AUTH=1 | Edge149.0.4022.98，五视口6项检查PASS，browser/verification.json及截图 |
| 五视口 | 1440×1000、768×1024、390×844、320×740、844×390；历史来自真实恢复库，行情/认证fixture，故障503为主动注入；pageerror=[]，1条503 console error如实保留 |
| UI实看 | mobile/desktop截图已查看；同数据/默认折叠、许可/限制可读，键盘/44px/无横溢出、返回1周周期、慢请求/失败保留已测 |
| 真实批次/恢复 | collection.json、real-integration.json、restore-final.json，60原值、原库hash不变、0重复请求、Node22子进程恢复一致 |
| 生产/远端CI/真机/真实断电/性能负载 | 本轮NOT RUN，不用本地/模拟替代 |

独立GPT history29_source_contract只读PLAN核对官方路径/许可及持久限额/raw版本要求；稳定diff发现1个P2：超限流的已交付字节被clamp少记。Builder新增oversized账本状态、保留真实bytesSeen并验证恢复；新增反例。Auditor独立内存复验131073字节与131072预留分开，错误组合拒绝；实际60条备份逐日/原文/hash复核一致，VERIFY无新增finding。其审计不等于它重跑了协调者的全量/UI测试。

DS本片实际调用0；没有将来源、身份及关键保存判断外包。无实测瓶颈，Optimizer跳过。

### 运行与剩余范围

项目根Node>=22.15，通用前缀：
node --experimental-strip-types --import ./scripts/register-types.mjs scripts/coinmetrics-history.mjs

- api-status / api-query btc / api-query eth：查看固定九月批次。
- api-collect：显式手动获准批次；已成功的本批再运行0请求。没有下一月/扩资产选项。
- api-backup <新相对文件>；restore <备份相对文件> <新空目标>：有界备份恢复，不覆盖数据。
- 原collect/status/query、extract-may/may-*命令保持原目标，不能用它们代替新API批次。
- 安全启动沿用Stage C工作台说明，referenceName改为coinmetrics-api-sep2026/restore-final/archive.sqlite；独立本机会话key，不使用/暴露生产访问码，20分钟自动结束。

该有限九月日频缺口已解决。长期原生日线OHLC、小时/分钟历史、Relative/Alignment/Transition历史方法、真实分钟研究/成熟前瞻、正式更大名单及项目外保管继续开放，未改原目标。现有生产记录仍Market Radar 2.8 Foundation P0 / Sites v29；本轮候选未push/merge/tag/deploy，无持续采集。

### 本批最终证据核对

2026-10-03，独立GPT history29_source_contract最终只读终审VERIFIED：10文件哈希及指纹be7841c7f4d6bb66d48be44af40bd43f7d543c1791e68da80c280fe127d35748一致，353项中352PASS/1SKIP、Node22 39/39、真实60点/2请求5171bytes/旧库不变、五视口6项及fixture/真实身份均与报告相符。无新增文档或证据误报；未把日频完成说成完整2.9/分钟研究或上线。

协调者git diff --check通过（CRLF提示保留）、暂存为空；36个文档本地链接0损坏。预览两个进程已停止并确认5296/5297无监听；停机检查是协调者执行，不归入独立Auditor的实测范围。无后续常驻任务。

## 后续网站只读交付切片

2026-10-03新增 /api/reference-history 与现有历史UI显式加载，真实固定九月BTC/ETH60条，原日期/美元小数/来源/版本不变；本地生产构建HTTP与五视口通过，尚未部署。详情、同机额外恢复、新测/历史区别见[tasks/MR-29-PUBLIC-REFERENCE](../tasks/MR-29-PUBLIC-REFERENCE.md)。分钟方法不适用；原九月CSV0与五月46归档仍原位保留。

2026-10-03更新：上述批准九月日频网站查询已随Sites v30/source749c727上线；本机原库、完整备份未上传，分钟研究/长期目标未完成。[发布记录](../tasks/archive/MR-PUBLISH-REFERENCE29.md)。
