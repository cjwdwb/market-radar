# MR-HISTORICAL-INTELLIGENCE-28

2026-10-02，基线1f87fc6bf3a34addf2d827a0689cf56888e6eb49；开始工作区/暂存/未跟踪空。生产记录2.75维护/Sites v27，源码4f84e5c。独立分支codex/mr-historical-intelligence-28。旧QA不重开Gate。规划遵循market-planner；本卡由协调者单写。

## 原需求承接与真实条件

| 原2.7需求 | 实际已有 | 本次接口/工作包 | 仍缺/完成条件 |
| --- | --- | --- | --- |
| 自选状态 | watchlist-state同源2.6；当前代码无2.8实现 | C回归、不另建分类器 | 回放与实时完全隔离 |
| 信息面 | FED固定公开宏观元数据→SQLite→本地导入；非个股资讯 | A来源核查/C保留入口 | 正式集合/实体依据与其他来源，宏观不能替代 |
| 九月价格 | ArchiveStore只允许fixture价格；未发现正式集合/批准价源材料 | A登记、B复用版本查询/恢复，先开发受限查询包 | 获准真实来源/用途/集合/预算/保管后小范围实采再扩集合 |
| 回放与研究 | directionForWindow/volatilityForWindow已导出，固定研究协议仅文档 | C历史校验+复用数学，D固定研究本地实现 | 真实价格重算与真实研究验收不能由fixture替代 |

已集中询问两项：正式资产/必要基准及价源用途/费用；正式数据根、备份和期限。用户尚未答复。默认数组不作正式集合。不读取私有浏览器，不采集真实价格、不迁移DB、不买服务、不启用cron。来源只读官方资料复查独立进行。条件阻塞只限制相关真实动作，继续隔离C/D功能。

## 冻结第一切片：现有归档→查询包→回放→研究→UI

不是完整2.8缩减验收，而是源准入前可执行里程碑。A正式价格注册、B正式根目录/大容量分片、信息关联及真实研究保持本任务开放，不能全部Deferred后称2.8完成。

| 接口/所有者 | 输入→输出 | 失败/版本/依赖/验收 |
| --- | --- | --- |
| B exportHistoryPackage / GPT | ArchiveStore + owner/source/asset/[from,to)→不含owner的单资产版本包 | fixture-only价源；固定readRevision同一只读事务；query每页200、总≤2000条、≤31天、≤2MiB；不得网络/改预算。history-package-v1，校验和不授予许可 |
| C parseHistoryPackage / GPT | 显式文件文本+now→严格规范包 | 拒绝超限/未知身份/未完整/乱序重复/数值与元数据无效；SHA完整性、原生5/15m、fixture session不冒充真实；实际exportedAt≥receipt≥barend；未来记录不进入asOf |
| C replayHistory / GPT | 包+asOf+calculatedAt→Short90/Medium180 direction/RMS、实际窗口/依赖、限制 | 不造Quote/session/fetchedAt；只用asOf前完整bar，同一连续suffix，至少22根+各窗pointCount；缺尾/缺口明确；复用既有纯数学/2.6窗口floor，无实时文件修改 |
| D researchHistory / GPT | 同包+T+createdAt→固定协议、候选/排除账本、最多200样本及min/median/max | same-asset-short90-forward30-v1；同分类、net差≤0.30pp、eff差≤0.20；先资格再时间贪心非重叠（完整22bar依赖+30m目标且与查询依赖不重叠），后按net差/时间排序；min10。仅fixture当前版本描述模拟，不称PIT/预测。数据版本+SHA可追溯 |
| C UI / GPT+DS | 文件包→独立历史区域、asset/asOf/价格分页/证据/研究/返回实时 | 默认折叠，读文件限额/代次保护、失败保留原包与query、取消旧计算；无网络/实时snapshot写入；DS只渲染已算事实与限制，不算金融值 |

初始独立历史契约history-replay-v1：事实开盘time/结束time+interval与版本receivedAt、exportedAt、asOf、calculatedAt分开。数据身份fixture、输出historical_simulation/current_vintage；real reconstructed/observed_live/PIT准入尚未批准，严格拒绝冒名导入。有效22bar规则来自market-input；收益窗口分别90/180m，RMS后1/3对前2/3。asOf必须存在精确完整末bar；只切连续后缀，不插值/跨缺口；fixture_only不提供真实session证明。Short不足不补中性，Medium不足不拖垮Short。Relative/Alignment/Transition在此切片注明尚未接入历史参照契约，不复制计算；后续仍需支持可证明维度。Signal/冷却/当时freshness not_reconstructible。

D完整依赖从末点之前max(22,90m/interval+1)根的第一根开盘算起，候选目标结束严格<T且≤查询依赖起点；目标价格必须精确端点且连续。以完整特征+目标区间消重，边界仅接触允许。失败insufficient/query_unavailable，样本不足不改阈值。没有校准/预测收益声明。前瞻记录/结果追加仍列D后续独立接口，不能以本次描述研究替代。

## 允许路径/分工/验证

GPT：lib/history/*（包/校验/回放/研究）、scripts/history-package.mjs、tests/history28*.mjs及fixtures/history28*、components/radar/history-workspace.tsx、radar-feed.tsx最小接入、tests/browser/radar.mjs受限扩展、tests/performance/history28.mjs按需、本卡/ACTIVE/一份docs/HISTORICAL_INTELLIGENCE.md。DS独立worktree：components/radar/history-result.tsx（纯展示固定props，契约后实施），不动ACTIVE/核心/真实数据。无依赖/源策略/schema修改；不动原live数学/prepare/Signal。

相关测试先固定手算、旧函数等价；身份/时间/无效数据/缺口/修订/分页固定版本/恢复同回放；研究筛选边界/未来修改不影响asOf与选样/非重叠/不足。本地导出/新空目标恢复只使用新fixture DB，拒绝真实源。类型/build/全量Node/受影响lint；五视口现有loopback harness验证隔离/失败保留/快速切换/返回及受影响旧流程。真实时钟对查询/回放/研究有限规模测量，与冻钟正确性分开。实测无瓶颈不Optimizer；不碰旧lint债务。

DS既有worker实际身份/能力核对后派纯展示；一轮+一次指定修正，不无限修工具链。正式数据/私有名单不外发。稳定diff独立GPT Auditor；若受阻明确记录。无push/merge发布分支/tag/deploy/收费/生产操作授权。

## 2026-10-02 首个隔离里程碑实际结果

- 代码：新增单资产受限历史包、固定revision导出、独立历史校验/回放、冻结协议研究和默认折叠UI。现有source-policy/schema/live算法未改；无新依赖。真实价格0条、正式保管未配置，未冒称全部2.8完成。原2.7四主线仍开放。
- SOURCE：官方OKX规范协议200，9.4确认未获书面许可不能向第三方展示/再分发；技术文档部分200，SEC403停止。本次6次官方文档尝试/5个HTTP响应；无价格端点。详见docs/HISTORICAL_INTELLIGENCE.md。
- 修复：浏览器发现新返回触控按钮不足44px，已修并在五视口复测；独立核心GPT发现LOW偶数中位数溢出，已用稳定均值/有限性守卫和合法极值回归修复。独立核心VERIFY PASS，研究4/4。
- 最终新测：Node279/279（专项10/10包含其中）、build/typecheck、受影响ESLint、git diff --check通过。build入口node node_modules/vinext/dist/cli.js build；typecheck node scripts/typecheck.mjs；Node node --experimental-strip-types --import ./tests/register-types.mjs --test tests/*.test.mjs。未声称npm test包装命令运行，也未重跑无关全仓lint。
- 最终候选浏览器：Edge149.0.4022.98，loopback本地production build，合成认证/行情/历史；五视口及三档动效历史9条、旧宏观8条通过，两个report均pageerror=[]/warnings=[]。极端统计修复前旧State/Integration/Motion综合58条通过；pageerror=[]，记录25条资源console错误，不冒称无warning。没有用旧综合记录代替新历史重测。全部视口是桌面模拟，生产/真机NOT RUN。
- 请求：历史查询和旧导航暂停polling的隔离检查新增API请求0，非生产polling测量；无新增provider/symbol/timer。
- 测量：2000条fixture，五轮SQLite查询+包校验59.5–70.1ms，回放+研究14.1–25.2ms；真实performance.now，不是FPS或真实预测成绩。独立同机基线build主JS772454→789648 bytes（+17194/+2.23%），总JS1049958→1067152；保留既有chunk warning，未进Optimizer。
- DS实际：deepseek-flash/deepseek，受监督CLI两次（实现+指定修正），纯展示history-result.tsx来自独立worktree，经GPT复查/类型/浏览器验收后接入。无真实数据/凭据外发；修正轮违反不使用apply_patch包装器的任务约束，工具可靠性限制保留。未改Provider。
- 证据：docs/HISTORICAL_INTELLIGENCE.md；忽略目录outputs/history28含build/typecheck/node/targeted日志、两套浏览器report/五视口截图、性能和bundle记录。临时fixture数据库导出/跨进程/新空库恢复测试通过，不是长期保管或正式备份。现存真实/用户数据库未修改。
- 完整交付GPT审计：VERIFY PASS，固定产品diff及未跟踪文件、导入/交互/权限/证据复核无confirmed finding；最终任务索引/FED8条报告补记独立复核PASS。独立审计未重跑全部测试，不冒称生产/真机/真实源验收。

## 仍开放，不能归档为完整完成

正式集合/必要基准、来源各用途许可、预算硬上限、正式根目录/备份/期限尚未答复。受阻对应A准入/B真实回补和正式恢复/C真实个股信息/D真实研究验收。Relative/Alignment/Transition历史契约、前瞻情景与append-only结果、正式分片大容量、覆盖账本和真实样本研究仍待后续切片；不以fixture删除这些目标。

代码/隔离功能验证与真实数据验收分开：当前只能交付隔离里程碑，完整2.8尚未完成。未提交、push、merge、tag、deploy、购买、生产迁移/回补写入或持续云采集。现有生产仍2.75维护/Sites v27，本轮未重新发布。

后续授权更新（2026-10-02）：用户允许完善、上传部署及项目内整理文件数据；发布由MR-PUBLISH-HISTORY28-FOUNDATION跟踪。本机文件位置已按data/README整理，无需重复确认；异地备份/期限、正式资产与获准价源、真实回补/研究仍未完成。此前未发布/无发布授权为开发阶段记录。
