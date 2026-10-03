# API 契约索引

2026-10-03本地信息入口新增（未部署）：`GET /api/information`经原Worker accessGate，仅返回已审核构建输入的fed-monetary-view-v1。无参数；任何非空query400，非法发布包503，原门禁401/未支持方法405；private,no-store（Worker补max-age=0）。固定FED货币政策元数据、1MiB/200条/31日原校验、reconstructed/current-vintage；不接受URL/路径/SQL、不读数据库、不网络采集、不包含owner/run/账本。UI首次展开懒加载，保留本地文件导入和失败旧视图。准备方式与证据见[信息入口交付](INFORMATION_DELIVERY.md)。

基线 87925c4；修改接口时同时核对这里指向的实现和调用方。下表是现状摘要，不是新协议。

| 接口 | 输入 | 响应/失败 |
| --- | --- | --- |
| GET /api/quotes | symbols 逗号分隔，去重后 1–28 个，符合 VALID_SYMBOL | {results: QuoteResult[], fetchedAt}；无效 400；结果内可有单代码 error |
| GET /api/history | symbol；range 默认 1d，可为 15m/1d/1w/1m/3m | {symbol,range,points,currency,timezone,source,fetchedAt}；无效 400，取数失败 503 |
| GET /api/monitor | 站主身份及服务端监控配置 | 代理云端状态；身份失败 401，未配置/连接失败 503 |
| PUT /api/monitor | 同源；JSON 设置，正文最多 30000 字符 | 转发云端状态/状态码；来源失败 403，过大 413 |
| POST /api/access、/api/access/logout | 门禁表单，细节见 worker/access-gate.ts | 设置/清除访问会话，返回重定向 |

- 所有 app API 还受 worker 门禁影响；不把报价接口当作无认证公开端点。
- Quote、QuoteResult、Point、PriceAlert 的唯一类型定义在 lib/market.ts，避免复制整套字段。
- 时间戳为毫秒；保留 timestamp 与 fetchedAt 的区别、nullable 数值、source、timezone、session。
- USDT 为 OKX 滚动 24 小时涨跌；Yahoo 相对前收盘价。不得在归一化时混为同一口径。
- 成功行情响应使用 no-store；不修改错误码或将局部失败静默变成零价格。
- Radar 2.1 没有修改 API response。客户端把必要 benchmark symbol 合入既有 `/api/quotes` 分组；crypto benchmark 历史复用既有 `/api/history`。benchmark 是内部 snapshot 依赖，不代表用户自选，局部失败不改变其他结果。

## 独立 monitor 服务
实现和校验：monitor/worker.mjs 的 validConfig、status、fetch。
服务端 Bearer MONITOR_TOKEN 鉴权；不向浏览器泄露 token。
GET 状态；GET /history；POST /run 手动执行；PUT 设置。站点代理仅暴露 GET/PUT。
PUT：enabled 布尔、watchlist 最多 20、alerts 最多 20；提醒 id 唯一，目标价和 createdAt 为正有限数。
状态含 enabled、watchlist、updatedAt、lastStarted、lastFinished、report、alerts；完整约束按实现核对。
存储代次由 createdAt 驱动，防止旧设置覆盖新代次/重复触发；修改需覆盖 monitor 测试。

## 2.7 local information view boundary

B1/C1 adds no HTTP route and does not change existing access/monitor contracts. `scripts/fed-history.mjs` is an explicit local Node operator command with a fixed source/database and durable hard limits, not a server handler. Public file contract `fed-monetary-view-v1` is validated by `lib/information/fed-view.mjs`: reconstructed/current-vintage metadata, frozen readRevision/range, bounded records, checksum(not authentication), source/time/coverage. Browser file import stays in memory; no upload, collector trigger or private universe fields. Physical SQLite schema2/logical fixture-v1 and real-v2 backups are separate. Details/limits/restore evidence: HISTORY_FOUNDATION.md B1/C1. Hosted authenticated history APIs remain Deferred.

## 2.9 Stage A-Q：本地归档查询前置接口

`ArchiveStore.query`新增可选`intervalMs`（仅bar、300000/900000），缺省保持旧全周期查询；显式周期进入游标签名。新增可选`readRevision`（整数0..当前revision）；首请求缺省latest，后页缺省沿cursor版本，显式必须与cursor一致。非法周期/版本分别`INVALID_QUERY_INTERVAL`/`INVALID_READ_REVISION`，游标范围不符`INVALID_CURSOR`。单页200行、单窗31天含上限，不触发采集。

`exportHistoryPackage`透传两参数；仍fixture-only v1，2000根/2MiB及混周期拒绝不变。ArchiveStore已约束owner/source/asset规范身份，版本只表示本库收到的修订，不证明历史PIT可知性。新真实源、真实包、schema/HTTP服务均尚未准入；本接口不能直接作为公开查询API。状态及验证见[Stage A报告](HISTORY_STAGE_A.md)。

## 2.9 B-STORAGE-001：独立本地物理快照

`scripts/history-snapshot.mjs create|restore`只处理本地新目标，不是HTTP API。`archive-snapshot-v1`/`archive-restore-v1`分别记录同schema2物理快照和恢复receipt，单owner、≤256MiB/400000facts；旧JSON与浏览器格式/限额不变。恢复停用采集、保留预算/冷却/停机原因并清执行租约；有manifest不代表来源已获准。正式价格和项目外保管仍未落地，契约/操作/实测见[Stage B报告](HISTORY_STAGE_B.md)。

## 2.9 Stage C：显式本地工作台

`scripts/history-workbench.mjs`仅手动loopback会话，不是已部署Sites API。`/__archive/{catalog,query,prices,records,record,register,evaluate,health}`均POST，同源精确Host/Origin + 独立内存会话key，JSON≤8KiB/no-store，无CORS。固定一个已验证B快照、owner和独立schema1研究账本；不能由请求指定库路径、owner、任意URL或金融结果。普通app访问码不等于归档key。

查询固定snapshot/series/from/to/asOf，价格100根/页、研究120000根/3000页/合作式20秒；partial无全范围统计。查询与记录不触发采集；所有价格仍fixture-only，日线/小时和真实身份未准入。登记从可信service重算并核owner/snapshot，实际服务器时钟；更正和到期结果追加，不覆盖原件。实际域/形状/错误边界以runner为准，长期契约、限额和安全启动见[Stage C报告](HISTORY_STAGE_C.md)。原线上quote/history/monitor/access协议不变。

## 2.9 CM日频本地补充（2026-10-03，未部署）
固定Coin Metrics/PriceUSD/USD/1d独立SQLite schema1；原ArchiveStore2、分钟包及研究协议不变。操作员scripts/coinmetrics-history.mjs只处理获准固定profile，无任意URL或请求触发采集。批次请求保守持久预留，恢复默认禁采集。
现有loopback工作台新增可选referenceName（仅启动参数，不是HTTP输入），固定只读事务。catalog附reference-catalog-v1；POST /__archive/reference-query正文仅asset/from/cutoff/version，完整原Host/Origin/key边界；最多批准的30日，原decimal string、完整序列/固定内容版本、查询范围和批次覆盖分别返回。失败局部降级；reference-only拒绝分钟/研究路由，不制造模型适用性。
coinmetrics-local-snapshot-v1只用于有界本机恢复（1MiB/60事实/4实际尝试），不是旧浏览器包/大型全库备份；SHA256只验完整性，不是来源身份认证。实际九月0覆盖与原文件时间限制见HISTORY_STAGE_A；没有生产接口或公开数据部署。

### CM-MAY2026-OFFLINE-001 固定离线profile

schema1不变，只新增白名单May profile：[2026-05-01,2026-05-25) UTC / BTC、ETH / USD / PriceUSD / 1d。不是任意日期采集API。May永久拒绝reserve/collect，status的requestAccounting明确继承父批次，newRequests=0。query.coverage.expectedDates来自固定profile（五月24，九月30），非UI硬编码；原reference路由/身份/31日上限不变。

查询附derivation：offline_reextract、derivedAt、parentBatch/parentSnapshot/parentVersion、有界parentEvidence；原receivedAt不改，父checksum不是签名/PIT证明。restore必须保留BTC/ETH两份来源和父请求账本，允许合法价格缺值；完整内存验证、pending库关闭/fsync后独占新目标发布，不覆盖原库，不修改旧逻辑snapshot格式。实际May46/48、Sep0/60，价格精度原文保留。

仅新增离线操作员extract-may/may-status/may-query/may-backup；生产接口与实时行情/State/提醒协议不变。五月公开展示许可已核对，不等于本轮部署了公开查询服务。

### CM-API-SEP2026-002 固定Community API profile

2026-10-03：同schema1/snapshot-v1，固定btc/eth USD PriceUSD/1d、UTC sourceDate [2026-09-01,2026-10-01)。新增api-collect/api-status/api-query/api-backup本地操作；原CSV/May命令及接口保持。官方Community无key单页固定URL，4尝试/30s/成功体128KiB/串行持久1s冷却，后页拒绝。API provenance使用transport=community_api/响应SHA/实际receivedAt；不伪造commit/blobSHA。流超限oversized记录真实已交付字节，预留不等于实际消耗。

reference-query固定完整序列与内容版本，API和CSV来源在现有UI区分；日频不支持分钟状态/研究，查询不启动采集。实际新九月60/60见HISTORY_STAGE_A，原0/60是旧CSV批次。无新增生产路由/迁移/部署。


### CM日频网站只读快照（2026-10-03，本地候选未部署）
GET /api/reference-history 经原worker accessGate；无参数返回reference-catalog-v1；完整且仅asset/from/cutoff/version返回原ReferenceQuery。仅批准BTC/ETH/PriceUSD/USD/1d、[2026-09-01,2026-10-01)UTC完整日的子范围。额外/重复/非法参数400，旧版本409，发布包非法503；POST405，所有响应private,no-store。没有DB、provider请求、采集入口、用户配置或计时器。data/published/coinmetrics-sep2026.json是6445bytes构建输入，校验<=32KiB、原始来源解析与原archiveVersion；不在public直接暴露文件。旧/__archive接口及分钟规则不变。

2026-10-03更新：上述批准九月日频网站查询已随Sites v30/source749c727上线；本机原库、完整备份未上传，分钟研究/长期目标未完成。[发布记录](../tasks/archive/MR-PUBLISH-REFERENCE29.md)。

### 长期日频发布包（2026-10-03，Sites v31已发布）

同一GET路由改读`coinmetrics-long20261003.json`，批准范围为BTC/ETH、PriceUSD/USD/1d、[2021-10-01,2026-10-03) UTC。无参数返回目录；查询仍须完整asset/from/cutoff/version，单响应最多31日，page.nextFrom用于固定版本续页。queryRange保留请求范围，coverageRange及coverage仅描述本页。400/409/503、405、原门禁与private,no-store不变。

publication-v2上限512KiB，实际360699bytes；包含14个有界公开响应及原批次/取得时间，完整重建原数据版本和逐日首次/修订时间。仅允许冻结计划下14/16/18个有序响应（后两对仅为既定有限修订），same-value不新增事实版本；dataset/checksum/来源身份均校验。不接入SQLite、实时源、网络采集或定时器。旧32KiB publication-v1及九月包保留兼容；两者不冒充分钟OHLC、PIT或State输入。

## 官方项目/产品资料快照

GET `/api/asset-information`：继承原门禁，拒绝全部query参数（400），无效构建包503；固定`official-information-v1`、128KiB、5源×5条元数据，原链接/版本/来源时间保留，private/no-store。网络抓取只在操作员手动runner，GET不接触SQLite/外部API。与FED `/api/information` 分开；产品版本不是财报、新闻或Signal。[契约和维护](INFORMATION_SOURCES.md)。
