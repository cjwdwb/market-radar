# MR-29-SEPTEMBER-GAP — 解决九月真实日频缺口

2026-10-03；用户“你去找找吧，这个版本把这个问题解决”。承接BTC/ETH免费非商业公开展示目标，保留五月与原九月档案。

## Planner / 调查阶段
基线073adc3d1f47a1db1647a1f689629b4998f55196，原分支codex/mr-29-c-research-workflow、PR#2已上传且最终CI344/344通过。工作区干净。生产仍Sitesv29，本次不沿用上传/部署授权。

目标：找到实际覆盖2026-09-01至2026-10-01（UTC半开）的合法源，优先延续Coin Metrics USD/PriceUSD/1d，完成有限本地采集、持久/版本/覆盖、查询展示、新空恢复；至少两资产九月真实值和明确缺口，不以五月/fixture替代。

非目标：不购买/开付费资源/生产迁移/修改实时行情/研究模型/持续调度/自动push或部署；未确认的分钟和长期范围继续开放。

第一片仅只读官方来源/权利/技术核查与任务文档。允许低频公开文档、端点元数据与有界小样例（不含用户私有资产或凭据）。不绕403/验证码/付费墙，不换域规避；未知许可不当允许。优先Coin Metrics Community官方接口许可、PriceUSD日终timestamp、可回溯范围及免费限额，再按证据选其他明确获准来源。

进入采集/存储Builder前定稿：源/用途证据、精确身份/时间语义、有限批次/请求/字节/写入硬上限、独立保存路径、版本/首次收到/幂等/断点/失败规则、UI和恢复方案与允许路径。当前用户已授权解决BTC/ETH九月缺口及非商业免费展示，不重复索要同一用途决定；只有费用或新增生产动作另需授权。

验证：真实源与fixture分开；保持原五月46/48和旧九月0/60原始记录，以新批次记录实际补得数据。原参考价/分钟边界保持；相关Node22/24、恢复重开、受影响lint/typecheck/build/UI，稳定候选独立GPT审计/修复复核。无瓶颈不Optimizer；DS不得决定权限/身份/单位/核心保存。

当前允许写入：本卡/ACTIVE、必要来源证据outputs/september-gap/。产品范围待契约定稿，未预填成功。

## 官方Community路径核查与最小试读
2026-10-03：官方packages/coin-metrics-community-data文档明确Community Metrics免费，链接CC BY-NC4；该许可本身支持符合署名/修改说明要求的非商业复制/分享。原CSV仓库声明来源即Community API。仅批准用途中的BTC/ETH PriceUSD/1d可考虑，不能外推PRO服务、原生分钟OHLC或所有Reference Rates。细粒度Reference Rates仅7点限制，与日频PriceUSD分开核对。官方Price文档确认日期D为UTC日终、证据截止D+1。

试读P1固定api.coinmetrics.io/v4/timeseries/asset-metrics，btc/eth、PriceUSD、1d、[2026-09-01,2026-09-02)，page_size10/end_inclusive=false；一次HTTP、128KiB/20秒、0重试/0后页/0费用，不需API key。先记reservation再请求，拒绝跳转/401/403/429，不换域绕过；仅保存研究样例及实际receivedAt/SHA，尚不进生产/原DB。读取真实覆盖后再定稿后续整月批次，证据outputs/september-gap/。

P1实际结果：api.coinmetrics.io返回401/88bytes，停止该入口且不重试。官方SDK test_base_url明确带key主域/无keyCommunity独立入口，证据sdk-excerpt.json；不以OpenAPI服务器列表代替授权。正在补核Coin Metrics Master Terms对Community适用性，未新请求免费入口。

Community正式入口依据：官方SDK固定版无key断言community-api.coinmetrics.io，官方data生成脚本同域。Master Terms 1.1/1.2、3.1及p6/7定义限定双方Order Form服务；本次无Order Form/PRO使用，免费Community数据另有明确CC BY-NC4许可。本项目非商业保存/展示沿该许可并保留署名/修改说明/无担保；不外推他人服务或商业用法。

P2最小试读：同P1两资产九月1日PriceUSD/1d，仅改为SDK规定的官方无keyCommunity产品入口，不重新访问被拒主域。上限1次/128KiB/20s/0retry/0后页；若公开入口拒绝则停止，不能轮换。P1保留88bytes/401消耗，两次试读独立记账。

## Builder定稿（2026-10-03，P2真实试读后）
P2为官方Community独立产品，HTTP200/182bytes，BTC及ETH各一条2026-09-01 PriceUSD。来源契约经独立GPT history29_source_contract核对；并非整月覆盖证明。

批准本地批次CM-API-SEP2026-002：BTC/ETH，USD PriceUSD/1d，[2026-09-01,2026-10-01) UTC，60日期格。每资产一个固定Community API请求，page_size100/paging_from=start/end_inclusive=false。正常2请求，持久总上限4请求、每次128KiB/30s、每批512KiB/120s，串行且至少1秒源间隔；拒绝/429持久停用/冷却，不自动重试、不跟重定向或nextpage、不动态扩大日期/资产。两次能力probe共270响应字节单列，不混入采集账本。

数据：PriceUSD原十进制字符串，UTC源日D结束D+1，完整响应必须无后页；乱序/重复/跨资产/未知字段/越界/不完整日期拒绝；空值与缺日区分。reconstructed/current_vintage，实际receivedAt，sourcePublishedAt=null；API transport+响应SHA版本，绝不伪造Git commit、当时观察或PIT。署名CC BY-NC4/原文/修改说明保留。覆盖仅说明日参考价格，不承诺来源准确率/交易所OHLC/分钟研究。

存储：复用CoinMetricsArchive schema1和有界恢复格式，新增严格固定API profile，原CSV/五月字节及契约不变、不迁移。独立work/state27/coinmetrics-api-sep2026/{archive.sqlite,raw,backup-v1.json,restore-check/archive.sqlite}。原始响应可靠落盘后，同事务写事实/成功checkpoint。缺失是partial，不伪造全覆盖；重跑已成功资产零请求；恢复禁采集并保留消耗/冷却。受控本地工作台只读新库，浏览器不访问供应商。

允许写入：collector/coinmetrics-api.mjs（新纯adapter）、collector/coinmetrics-archive.mjs、scripts/coinmetrics-history.mjs、lib/history/reference.ts、components/radar/reference-history.tsx；相关tests/coinmetrics-*.test.mjs、tests/history29-http.test.mjs及现有browser harness必要断言；本卡/ACTIVE、既有MR29主台账/来源/交接/CURRENT_STATE必要章节，outputs/september-gap/和上述独立数据目录。无新依赖/实时策略/研究算法/生产改动。

验收：先受影响Node22/24模拟测试（边界、分页拒绝、128KiB、幂等、429/拒绝持久、故障/断点、新空恢复、防provenance伪造及旧profile回归），再实际2请求整月，逐日与原响应一致、原两库hash不变、重开/重跑零新增请求、新空恢复和跨进程查询相同；五视口真实参考数据+模拟行情/认证分开标识；稳定diff lint/typecheck/build/全量Node及独立GPT审计/修复复核。长期外部备份、公开网站部署与分钟/多年目标仍另列未完成。

## 本批最终交接
2026-10-03：CM-API-SEP2026-002完成BTC/ETH九月各30个真实USD日终参考值，共60/60、缺日/空值0；2请求/5171响应体bytes，能力试读另2请求/270bytes。逐条原十进制与日终/时间核对；重跑0请求、原五月/旧九月hash不变；32768bytes库、10775bytes备份，新空恢复及Node22子进程查询一致。原source文件均保留，没有回填过去receivedAt或伪造PIT。

Planner三条审查已落实：事务内持久源间隔、按请求/响应SHA独立raw、profile字节上限兼容。独立审计1个P2（超限响应clamp导致实际字节少记）已修：oversized状态保留真实已交付值、成功体上限/预留分开；反例/新空恢复通过，独立GPT VERIFY无新增finding。128KiB不表示传输层含头/重传字节绝对不会超出，实际账本限定可观察响应体。

最终353 Node：352PASS/0FAIL/1既有Windows symlink权限SKIP；Node22目标39/39，build/typecheck/6文件ESLint通过。Edge149.0.4022.98五视口6检查通过：真实参考数据、fixture行情/认证、注入503/延迟；1预期503 console，pageerror=[]。手机/桌面截图已实看。命令、版本、来源权利和运行手册见[Stage A完整报告](../../docs/HISTORY_STAGE_A.md)。DS0，Optimizer无瓶颈跳过。生产/远端CI/真机/真实断电本轮NOT RUN，不用历史结果代替。

本有限批次代码与真实九月日频交付完成；不是2.9整体完成，不自动继续采集。长期OHLC/小时/分钟、真实分钟研究/前瞻成熟及项目外保管继续开放。新候选未提交/push/merge/tag/deploy；现有生产仍2.8 Foundation P0 / Sites v29，无新持续调度。两个临时预览完成后停止。最终报告/证据另由独立GPT只读核对。

最终独立证据终审VERIFIED，无新增误报；10文件指纹be7841c7f4d6bb66d48be44af40bd43f7d543c1791e68da80c280fe127d35748一致。协调者确认5296/5297预览已停、36文档本地链接无损坏。未提交或发布。
