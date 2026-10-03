# MR-29-INFORMATION-SOURCES-PUBLISH

2026-10-03，COMPLETE — 有限官方资料已上传发布。用户明确要求把币圈项目和公司信息也接入，并上传部署；仅限Market Radar。允许既有免费官方来源的有限采集/保存/展示、GitHub PR/CI/正常合并及原Sites发布；不购买、不创建新账户/调度、不修改秘密/访问策略。

## 基线和保留

HEAD/GitHub main均2ad86814abf5a0f40c50d7ad463d1de6633a859f；已有information29本地FED入口已通过审计但未提交，本轮一并集成。minute29未提交准备成果保持分开。Sites实际get_site确认v31、原公开平台权限加应用门禁、无调度。基线main CI run37115019039已核对成功。

## 调查与范围

复用原FED元数据、网站只读快照和本地归档模式。新增两个确有区别的信息类别：批准Crypto项目的官方客户端发布元数据、批准上市公司的官方申报元数据。只展示来源支持的标题/类型/时间/链接和经核验实体关系，不抓媒体全文、不猜消息利好/利空。

先核验GitHub官方API/公开数据与项目许可、SEC官方开发/公平访问/使用条款。Crypto候选BTC/ETH/SOL官方仓库；公司候选现有目录内美股，CIK匹配官方submissions。源被拒绝/许可不明确仅阻塞该源，不换身份/代理绕过。名单是本次有限公开信息覆盖，不冒称取得用户私有自选清单，访客添加不触发采集。

调查与小量样本合计最多24HTTP/16MiB、单响应2MiB、串行、至少1秒间隔、每次20秒、无自动重试；拒绝/限频遵守停止，不下载完整仓库。真实采集另冻结少量源/记录/字节计划后执行，不无限扩展。

Planner定稿后才进入新增产品Builder。允许路径预案：lib/information、collector的独立信息归档边界/脚本（不能放宽原金融事实准入）、components/radar信息入口、app/api信息读取、必要CSS、data/published、测试、任务/文档、ignored本地数据输出。实时行情/State/提醒/认证/旧价格库/分钟算法禁止改变。接口、版本键、上限、恢复/查询与测试契约待来源决策后在本卡定稿。

流程：Planner→Builder→相关及完整测试/五视口→独立GPT审计修复复核→GitHub CI正常合并→Sites原生发布。DS只接批准的低风险盘点/测试草案，GPT决定来源、身份、存储与最终验收。协调者单写ACTIVE，不新建Provider或Agent体系。

## 来源决定与首批契约（Planner定稿）

调查24请求已结束，原始响应仅ignored输出。GitHub Terms D.6（仓库已有许可下的贡献）/H（API限频）与各项目官方repo/license已核对，使用**版本号、发布/更新时间、稳定ID、预发布状态及原链接这些事实字段**；不复制release正文、创作性标题、作者/头像/个人资料、商标图片或源代码。标题由项目名+版本号确定生成，保留项目许可与官方归属链接，不将软件许可证宣称为整站新闻全文许可。

批准本批5个固定来源：bitcoin/bitcoin→BTC；ethereum/go-ethereum→ETH；anza-xyz/agave→SOL（Anza维护的Solana客户端，不是Solana全网公告）；NVIDIA/open-gpu-kernel-modules→NVDA驱动产品；microsoft/PowerToys→MSFT产品。每源已取得一页最多5个真实release，预发布明确标识，按publishedAt展示，但只声称取得的那一页，不声称穷尽最新公告/所有历史。现有FED不再次请求。

SEC三个标准文档/数据入口403，停止访问，不换身份/代理绕过；NVIDIA新闻页条款3.1/3.2限制公开展示，RSS不构成额外许可；Microsoft新闻RSS可读但terms路径404，未确认新闻转载许可；Nasdaq超时。这些不作为已接通财报/新闻。UI明确“项目与公司产品更新”和未覆盖申报/新闻，不把产品版本冒充公司财务公告。用户“全部接入”不能替第三方授予许可，仍交付可合法公开的两类真实资料，报告尚未满足部分。

### 时间/存储/查询

复用读取快照发布方式，保留FED原API/导入契约。新增唯一 `official-information-v1` 类型契约、固定来源目录与 `GET /api/asset-information`；每包≤128KiB、5源×5记录、无参数/原门禁/private,no-store。外部读取只在操作员任务，浏览/GET不采集。

原ArchiveStore的金融事实/FED专用准入不放宽；新增小型public-metadata SQLite模块（独立本地库，只有公开资料版本及来源快照，不复制价格回放/预算/研究系统）。逻辑键source+releaseID，内容hash，A→B→A追加第三版本；完全同内容不新增事实。每次来源快照保留精确版本引用，旧版本可查询；未出现不自动宣称撤回。hard cap5000版本/1000快照、单输入2MiB。未批准字段不落库/不发布。

已有24调查请求中的5份合法API样本作为本批实际数据，不重复下载：saved-file mtime是本次响应文件取得时间，另存真实首次入库/版本入库/发布包时间，绝不回填为来源当时观察。数据标current-vintage/reconstructed，发布时间不等于来源最初公开的完整修订历史。批次截止为各样本真实取得时刻，未来发布时间/更新拒绝。

后续手动采集脚本固定5URL，串行≥1秒、总5请求/10MiB/2分钟、20秒超时、2MiB每响应；来源全局滚动24h最多12请求，拒绝/限频立刻停止并保存冷却，不自动重试/切身份，不启用调度。本次先用已取得样本不再增加请求；该更新能力先隔离测试。采集前持久预留请求，失败仍计数；同机旧FED账本独立且不更动。

固定本地根 `work/state27/official-information`，数据/备份ignored；发布仅归属与必要公开事实。SQLite一致性VACUUM INTO新备份、校验后恢复至新空目标，新进程逐版本/快照和公开查询核对。不复制正在写入的主文件。无生产DB/迁移/远程存储/长期保管承诺。

### UI / 验收 / 允许路径

保留现有黑白样式。Radar已有区域新增默认折叠“项目与公司更新”，按当前资产/币圈项目/公司产品/全部过滤，五条分页、原文、新旧时间及预发布标签。资产关系是项目/发行人上下文，不涉及报价币种或因果；AAPL/TSLA及港A股/其他资产显示未覆盖而非无新闻。切换资产不能展示旧资料为新资产；文件导入及FED面板不回归。动态效果沿用既有规则。

允许新增 lib/information/official.{mjs,d.mts}、collector/official-information.mjs、scripts/official-information.mjs、data/published/official-information.json、components/radar/official-information.tsx、app/api/asset-information/route.ts；接入radar-feed.tsx、必要app/radar.css；相关Node/browser tests、任务/来源报告/发布文档。无新依赖/金融算法/旧存储schema修改。

验收：真实5源→元数据入库→重复导入/版本测试→一致备份/新进程恢复→API/UI。测试拒绝未知repo/URL/HTML/身份错配/未来时间，A-B-A及旧snapshot，失败不替换旧源，预算/429冷却/取消，API门禁/无网络/大小，UI默认折叠/按资产/预发布/未覆盖/加载错误保留/竞态/五视口及原FED导入和动效返回。Node22完整、build/typecheck/scoped lint、独立GPT审计/VERIFY，GitHubCI通过后正常合并，Sites原生发布；未覆盖申报/媒体栏目不宣传为完成。

## 最终本地候选

详见[来源交付报告](../../docs/INFORMATION_SOURCES.md)。真实25条新官方版本资料与既有2条FED资料；新调查24HTTP/1353312bytes，复用响应不重复下载。385PASS/1Windows权限SKIP，专项12PASS，build/typecheck/scoped lint通过；最终五视口23组PASS。独立审计P2子根路径、P3 Geth许可标签均修，最终VERIFY PASS。审计者独立20项只读负向路径检查通过，25暂存文件与报告核对一致；未重跑完整测试/浏览器，不冒称远端CI/生产通过。旧production v31未在本地阶段改动，GitHub/部署待下阶段记录。

## GitHub与实际部署

候选887ae99e36ac3b5317a6ef9ab69dd1fd3a3704a9，经PR #4正常合并为4a4b7fb66ac4fc10663087b42a09e08c55804e2a；tree均25e4ad5a509f16783b6890d1943eb780ad73bf7b。PR run37128514255/job111218688183，main run37128599240/job111218938679，Ubuntu/Node22.15执行npm ci→npm test各386PASS/0FAIL/0SKIP。既有chunk警告保留。

Sites官方workflow重新open取得当前SHA，再同步源码成功；Windows package-site无法启动，本机未生成archive。按原生工具允许的无archive远端构建fallback保存v32：appgprj_6a9b9dc23584819190a31ae417863e7a~appgver_6214008f5bdc819183abf31245e0891f。deployment appgdep_6ac10cdc5044819187b34baa7345f0b3于2026-10-03T14:12:26.019948Z返回succeeded，env revision3，https://market-radar-rex.swt-aether.chatgpt.site 。凭据仅隐藏stdin/内存，没有写文件；未修改访问策略、秘密、调度或生产数据库。后续文档提交不重新部署。

入口：Radar → 项目与公司更新 / 官方宏观资料。是已保存官方事实快照，不是自动新闻流；刷新仅读取发布包。25+2条真实资料可用，财报/媒体申报受许可/访问限制仍开放。完整2.9真实分钟、真实分钟研究、异地保管等不因本片发布关闭。生产登录后/真机NOT RUN，平台成功不替代。
