# 2.8 历史智能：隔离切片与未满足条件

2026-10-02。任务 `tasks/MR-HISTORICAL-INTELLIGENCE-28.md`；开发基线 `1f87fc6bf3a34addf2d827a0689cf56888e6eb49`。本报告不是完整 2.8 验收或发布声明。生产仍按已有记录为 2.75 维护 / Sites v27，源码 `4f84e5cb39abe48e81643a6364339a47a3701472`，本轮没有发布。

## 发布收尾更新（2026-10-02）

用户在上述开发完成后另行授权整理、上传和部署。按2.8 Foundation阶段版准备发布；实际部署结果以 `docs/VERSIONS.md` 和发布任务记录为准，下文“未发布”保留开发阶段时点，不表示后续授权撤销或未执行。

已新增可下载的302根模拟历史文件（真实生成时间、fixture身份）及既有两条FED公开资料（原文件/viewId/取得时间保留），见[data/README.md](../data/README.md)。没有原始库、备份、个人名单或凭据进入公开文件。数据库原位留在项目work/state27，data/local预留且被忽略；不把项目内目录当作异地保管。

本发布候选新测：281/281 Node（新增公开示例2项），build/typecheck、受影响lint通过；历史10条与宏观9条浏览器检查（均含五视口），pageerrors=[]/warnings=[]。新增实际页面认证下载→文件解析→导入身份验证；宏观下载使用既有真实公开元数据，周边行情仍fixture。首轮HTTP loopback独立请求客户端未发送Secure测试Cookie而取得门禁HTML；改为已认证页面fetch并检查Content-Type后复测通过，没有改动产品门禁。

精选可公开证据：[verification.json](evidence/history28/verification.json)、[桌面](screenshots/history28-desktop.png)、[手机](screenshots/history28-mobile.png)。主client JS最终790028 bytes，总1067532（原基线772454/1049958），新增静态JSON按需下载，不计入JS。此前性能测量为同一未变数学/存储路径；没有新增FPS结论。独立审计新增数据与产品收尾无confirmed finding，最终文档/证据复核见发布任务。

## 完成范围和 Gate

已实现现有 ArchiveStore → 有界版本查询包 → 独立历史输入校验 → 90/180 分钟方向/RMS回放 → 固定协议样本研究 → Radar 内默认折叠的本地历史区域。只接受 `fixture`，没有任何真实价格被改名成测试数据。没有网络、schema、来源准入、扫描、采集定时器或提醒业务变更。

| 原交付主线 | 本轮状态 | 后续必要条件 |
| --- | --- | --- |
| 自选与单资产同源 | 既有实现保留，旧工作流回归 | 本轮不重新创建状态分类器 |
| 资产相关真实信息 | 既有 FED 宏观链路保留；非个股资讯 | 正式资产/实体身份及获准来源；宏观不能代替 |
| 九月真实历史 | BLOCKED；真实回补0条 | 正式 universe、价格来源及用途许可、冻结批次/预算、批准保管位置 |
| 历史查询与回放 | 隔离功能通过测试 | 真实数据准入、真实 session/版本校验及覆盖验收 |
| 研究与可检验情景 | 描述性模拟管线已实现 | 真实样本/结果；前瞻记录与追加结果尚未实现，不能称研究全交付 |
| 正式保管/持续服务 | BLOCKED / NOT RUN | 根目录、备份目标、期限、运行资源/身份及对应授权 |

已一次集中询问资产/来源/预算以及正式根目录/备份/期限，暂未收到答复。没有读取私有浏览器自选，不用默认数组冒充正式集合。普通隔离开发已推进，相关真实动作受阻；完整 2.7 四主线及 2.8 目标仍开放。

## 官方来源复查

2026-10-02 低频只读检查，无资产端点请求：独立 GPT 4 次尝试（1 次沙箱 socket 失败、3 个 HTTP 响应）；协调者另 2 次读取明确重定向给出的同站规范协议地址（第二次仅提取被终端截断的条款）。总计 6 次尝试、5 个 HTTP 响应；没有使用代理、替代身份、隐藏接口或绕过拒绝。

- OKX 原协议地址返回302；规范地址 https://www.okx.com/en-us/help/okx-api-agreement 返回200，117037字节。9.2限内部/自有账户用途；9.4明确第三方展示/再分发须事先书面许可，限制用于竞争数据/分析平台，公开端点同样受约束。**不能据此批准本站新增对外历史服务。** 私人用途是否满足适用地区、账户和具体使用条件仍需核定；保存/研究/产品展示/导出分别确认，不将用户一般开发授权当作供应商许可。
- https://app.okx.com/docs-v5/en/ 返回200，Last-Modified 2026-09-30；读至2MiB即停，仅部分文档。确认历史K线20请求/2秒/IP、默认100最大300、after较旧/before较新、原生5m/15m及UTC日线分桶；未完整核对confirm/volume/实际回溯覆盖。未调用历史端点。
- SEC API官方说明返回403，停止该来源，未换身份重试；公平访问/身份声明和再利用仍待核实。没有申报记录被采集。
- 现有 FED 许可仅覆盖既定公开宏观元数据用途，本轮未扩展。没有购买服务、价格订阅或付费资源。

官方协议短摘录保存在忽略目录 `outputs/history28/okx-license-excerpt.txt`；它是研究依据，不是许可证明。核心源策略保持原样。

## 时间、版本与方法契约

`history-package-v1` 为单来源/单完整资产身份、原生5或15分钟、当前版本的模拟数据包。query每页最多200条、包最多2000条/2MiB、范围最多31天。导出在同一SQLite只读事务中取得固定revision；查询不启动采集。包剔除owner/run和个人偏好。内容SHA-256只校验文件一致性，不是官方签名或权限认证。

严格拒绝未知字段、混合身份/周期、非有限/无效OHLC、重复/乱序、未完成末根、非法版本和时间、超限输入。`range=[from,cutoff)`约束完整K线。版本入库时间不早于bar结束，导出不早于版本入库且不晚于显式now；历史asOf、真实calculatedAt和入库时间分别保留。fixture_only不证明真实session；当前版本不证明当时可知。文件是临时浏览输入，不是长期存储。

`history-replay-v1` 仅对明确asOf的完整精确终点取连续后缀；不插值跨gap，不制造Quote/fetchedAt/observedAt，不调用live prepare来伪装历史有效。最少22根及各窗口所需点数；Short90/Medium180分别降级。调用原 `directionForWindow` / `volatilityForWindow` 和 `ASSET_STATE_V2_RULES`：方向阈值、路径效率、RMS后1/3对前2/3、零基线行为均未改。时间范围以收盘间隔表达，完整依赖从额外有效性样本的首根开盘起计。Relative/Alignment/Transition的历史参照契约待后续，不能用当时事件或伪造session补齐；旧Signal/冷却/生命周期不重建。

研究协议 `same-asset-short90-forward30-v1` 冻结：

1. 同包的完整资产/来源/币种/调整/原生周期/规则；匹配Short方向及RMS分类，净变化差≤0.30个百分点、路径效率差≤0.20。
2. 每个候选+30分钟结果须有连续、精确终点；结果结束严格早于T，且不进入查询的完整依赖窗口。以当前版本作描述模拟，不声称历史可知/PIT。
3. 先资格过滤，再按时间升序贪心消除完整特征+目标窗口重叠；允许边界接触。最后按净变化差、时间排序，最多200个。
4. 至少10个才输出min/median/max；不足保留排除台账。不输出上涨概率、买卖分或投资结论。结果单位为简单区间收益百分数。台账保留不匹配、无效、缺结果、未成熟/进入查询依赖、重叠、上限截断。
5. 极端有限输入下中位数使用稳定均值并守卫有限统计。没有依据结果选择阈值，没有把历史模拟记成真实预测。真实前瞻append-only/pending流程仍未实现。

## UI与隔离

Radar Feed下方的独立折叠区域：显式导入文件、UTC截止、90/180窗口、折叠规则证据、固定版本价格分页（20条）、研究台账/前10个样本。来源身份、币种、调整、原生周期、asOf和计算时间可查；完整原始包仍在本地。返回实时Radar只折叠并恢复焦点，不更改selected/range或自选/提醒。

异步文件读取有代次保护，卸载失效；最新导入失败保持上一有效包/查询/页码。计算仅在有效导入/显式查询发生，无常驻timer、网络或实时缓存写入。文件大小和行数有硬上限。沿用动效/原生disclosure，按钮≥44px。

## 本轮证据

命令均在项目目录运行，Node v24.19.0，Edge 149.0.4022.98，Windows。使用loopback production build/Miniflare、合成认证及行情拦截，外部网络由测试运行时拒绝；未读生产Cookie/访问码。fixture、桌面模拟和真实行情严格分开。

- `node --experimental-strip-types --import ./tests/register-types.mjs --test tests/history28.test.mjs`：10/10（含独立审计发现的数值溢出回归）。22/37样本边界、原数学全对象对照、零基线、gap/截止、身份/哈希、未来数据变化、10样本门槛、跨进程SQLite持久化、导出/新空库恢复后回放一致。仅测试临时库，结束关闭后清理，不是正式备份。
- `node node_modules/vinext/dist/cli.js build` / `node scripts/typecheck.mjs`：最终数值修复后已执行通过。Windows直接分项，不冒称执行npm test包装器。
- 全量Node最终279/279通过，包含新增极端中位数回归；首轮278/278仅作过程记录。
- 受影响ESLint最终通过（含新增域、组件、脚本和浏览器测试）；没有全仓lint-clean声明，原有主组件lint债务保留。
- `RADAR_HISTORY28_ONLY=1`：五视口 + 三档动效9条检查记录；pageerror=[]、warnings=[]；慢旧文件/新文件竞争、错误保留、分页、局部缺失、键盘、44px、无横溢、返回焦点。1440×1000、768×1024、390×844、320×740、844×390。截图 `outputs/history28/browser/history28-{desktop,tablet,mobile,narrow,landscape}.png`。
- 最终数值修复后重新build运行上述9条；另 `RADAR_FED27_ONLY=1` 旧宏观8条通过（五视口、三档动效中的资产/手动周期往返），pageerror=[]/warnings=[]，未设置真实信息文件入口，全部是fixture。
- 既有 `RADAR_MOTION=1 RADAR_INTEGRATION=1 RADAR_STATE26=1` 回归58条检查记录通过、pageerror=[]；捕获25条资源console错误（401、503、ERR_FAILED，包含故障/门禁场景），不声称console全净。报告 `outputs/history28/regression/verification.json`。该轮在极端中位数修复之前，普通UI未因该修复改变。
- 零导航/历史查询请求是暂停polling的隔离实验；不冒充生产polling测量。真机/生产2.8、新真实源、真实回补与正式恢复：NOT RUN/BLOCKED。

`tests/performance/history28.mjs` 实测2000根：五轮有界SQLite查询+包导出校验约59.5–70.1ms；回放+研究14.1–25.2ms，70个模拟去重样本。使用performance.now，非冻结钟；不是手机FPS或真实研究效果。网络请求0。数据见 `outputs/history28/performance.json`。

同机器/依赖/命令的HEAD独立基线build对照：主client JS 772454→789648 bytes（+17194，约+2.23%），总client JS 1049958→1067152 bytes；最终记录见bundle.json。既有500KB warning仍在，没有证据触发Optimizer；不为流程做拆包或刷新策略变更。

## GPT / DS 与审计

GPT完成契约、权利核查、版本包、历史有效性/数学复用、研究核心、导入状态及测试。DS实际使用现有deepseek-flash/deepseek配置，CLI 0.155.0-alpha.16.4；独立worktree只实施 `history-result.tsx`，类型副本只读，无真实数据/凭据外发。初轮实现 + 一次限定修正，报告token约21203+14274（不是精确费用）。修正轮曾尝试任务明确禁止的apply_patch包装器，之后使用PowerShell，存在工具约束遵从问题；输出由GPT完整复查后接入，不认可其无人监督工具可靠性。未改Provider或配置。第一轮纯展示不满足细小数值和默认折叠要求，指定修正后已通过类型与浏览器检查。

独立GPT核心审计发现1 LOW：偶数样本中位数相加可溢出；已改稳定均值+有限性守卫并加合法极值夹具。核心独立VERIFY PASS，独立重跑研究4/4，原LOW无未解决项。完整UI/证据及最终文档补记独立审计VERIFY PASS，无confirmed finding；审计未重跑全部测试，未覆盖真机/生产/真实来源。详见任务卡。

## 本地运行和后续交接

仅针对已经存在的合法fixture数据库，显式导出：`node --experimental-strip-types scripts/history-package.mjs <db-relative-name> <query-json> <new-output-relative-name>`。query字段为owner/source/asset/from/to；exportedAt取执行时间。文件仍强制位于 `work/state27`，拒绝路径越界/符号链接、覆盖既有导出；这是隔离目录，不是批准的正式数据根。无新初始化、迁移或采集命令。正式来源未准入时返回拒绝，不换URL绕过。

本地性能复现：`node --experimental-strip-types --import ./tests/register-types.mjs tests/performance/history28.mjs`。浏览器沿用 `tests/browser/radar.mjs`，显式设置loopback、PLAYWRIGHT_MODULE、RADAR_SYNTHETIC_AUTH=1、RADAR_HISTORY28_ONLY=1；严禁指向生产。

尚需用户决定正式资产/必要基准、来源许可与用途、一次性/增量费用硬上限，以及正式根目录/备份/期限。满足后才能将真实adapter/价格准入、批次回补、逐资产缺口、正式恢复、真实信息和研究结果逐片接通。未推送、未打标签、未部署、未启用持续采集；不承诺离线后台继续运行。
