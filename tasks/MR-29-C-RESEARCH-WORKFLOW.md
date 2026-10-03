# MR-29-C-RESEARCH-WORKFLOW

2026-10-02，GPT Planner。用户明确启动C；不隐式关闭A/B。主台账仍MR-29-REAL-DATA-WORKFLOW。

## 基线 / 真实条件

main与HEAD31702c45c653e5e33bac258c110f159d432d5b87；本轮只读GitHub确认CI37004484343 completed/success（历史结果，不是新测）。现有生产Sites v29/source2ad04ee；A/B未提交成果保留在codex/mr-29-c-research-workflow。C前tracked.patch、原replay/workspace和production build保存在outputs/stage29c/baseline*。

A查询具备固定revision/原生5m与15m隔离，单页200/31天；B具备单owner有界一致SQLite快照和恢复。真实价格0条；未有正式清单、价格源许可/预算或项目外长期保管。现有宏观两条不能供价格回放。本轮不新增collector/source、扩大FED授权或伪造真实身份。真实研究/分层覆盖仍BLOCKED；这不阻塞以下隔离代码切片。日线/小时尚未保存且无原生契约，UI不虚构可选项。

## 最终实施范围

C1：复用A查询与B固定快照的本地受控查询入口；既有历史工作区可直接按序列/日期查询、上一/下一完整bar截止导航、显式选择建议时点、保留失败前结果，文件导入继续工作。

C2：same-asset-short90-forward30-v1的有界流式执行，与原整包研究逐对象对照；跨页保留依赖与全局时间消重，最后全局相似度排序/200上限。非新模型。

C3：独立本地研究账本：历史研究记录、fixture前瞻登记、关联更正和手动到期结果追加/幂等。不能标真观察或真实前瞻；真实来源接入与成熟结果留开放。库与原archive分开，不迁移既有库。

C4：现有五视口harness + 生产等效构建、真实推进时钟的组合负载基线/候选测量。无证据不做Optimizer改造；不可宣称高刷。

## 查询 / 权限契约

- 手动本地runner：指定B snapshot目录、固定owner、单独journal文件、固定loopback preview upstream与新端口。仅127.0.0.1监听；上游仅固定127.0.0.1、无重定向、无任意URL代理。原app门禁不改。
- `/__archive/*`本地接口仅POST，有界JSON，严格Host/Origin、无CORS、no-store；独立本地会话key从RADAR_ARCHIVE_TOKEN环境传入，不能用app访问码替代。key不入URL/日志/存储，仅浏览器内存；UI只在loopback显示连接入口。测试只用明确fixture key，不读生产凭据。日常查库不靠导入整个档案。
- 源必须既有archive-snapshot-v1并通过B hash/schema/逻辑检查，readonly打开，校验和整个会话共用固定读事务；不执行archive schema初始化/采集。snapshot identity是bundle hash+owner局部scope+series+readRevision，不把不同库revision混成全局版。额外C时间守卫closeAt≤receivedAt≤snapshot.createdAt≤serverNow，run.createdAt不晚于snapshot；不因跳过包导入遗漏未来取得检查。catalog最多100序列；只支持既有准入fixture价格，其他源明确unsupported。
- 全序列由server目录选择opaque key，客户端不能指定owner、DB路径、source URL或SQL。序列包含source/完整asset/currency/adjustment/native interval及sessionEvidence；固定snapshot贯穿浏览。
- 请求开盘范围[from,to)，且只收closeAt≤to的完整bar，收盘恰好to有效；最多10年。每次SQL≤31天/200条，返回价格页≤100条。计算最多120000条、3000查询页、20秒合作式预算；活动重作业≤2。取消于分页让出后生效，不承诺SQLite原生同步语句硬实时中断。研究不把最后2000根称全范围。
- coverage报告实际首尾/版本/已知记录与局部gap、未核验完整性；无真实日历不输出市场完整率或把缺口归休市。catalog是可查询目录，不是正式universe。

## 时点 / 数学契约

完整bar收盘是导航有效时点，与状态/研究资格分开。previous/next严格早/晚于请求T，在当前序列/固定范围/版本内取实际完成bar，不因研究不足排除。建议最近≤T的有效收盘只显示建议，由明确按钮选择；输入框不静默重写。回放请求T保持精确：缺精确末根则missing_endpoint，实际展示点为null。

原Short90/Medium180/22根最低有效性、方向/RMS数学不变；查询开始边界可能预热不足，明确扩大范围条件。跨查询页保留连续后缀，但真实gap立即断开。真实session不可用仍fixture_only；历史Relative/Alignment/Transition及Signal生命周期留Deferred。

流式研究在[from,T]实际遍历完整bar，asOf T与生成时间明确；结果目标30m必须严格早于T且不进入查询完整依赖。候选过滤顺序不变；跨页保留最多所需特征+目标窗口、previousEnd全局状态，所有非重叠候选参与全局top200选择，不逐页top-N。单位、阈值、最少10、tie排序与统计保持。固定小集合以原实现作oracle，检查每个sample和排除数，页大小1/7/200同结果。

超过预算返回partial及实际检查范围/原因，不能输出全区间统计；取消不覆盖已接受结果。Short有效/Medium不足和研究不足分别保留。snapshot/series/range/requestedAsOf/evidenceEnd/displayedAsOf/UTC/规则/协议标识进入结果及研究记录；计算不写实时状态、不改手动周期、提醒或动效。

## 研究账本契约（新隔离文件，schema1）

不改collector/schema.sql。独立research schema1以元数据、登记表、结果表构成，SQLite参数化事务，应用无UPDATE/DELETE接口且表触发器拒绝改写。每库单owner、≤1000登记/4000结果、单记录≤256KiB/库≤32MiB；列表≤20/页。已有非本格式文件拒绝，不自动迁移/覆盖。

登记身份严格枚举fixture_historical_simulation / fixture_prospective；real_reconstructed / observed_live / prospective真实身份本轮未准入，不能由UI切换为真。当前版本均current_vintage，不宣称PIT。historical记录完整查询描述、输入bundle/版本/摘要、实际asOf/计算/登记时间及输出；浏览器只提交引用与问题，金融结果由server重算/验证生成。

前瞻记录要求明确问题、实际登记时间（服务端时钟）、输入截止≤登记时间且30m目标尚未到期、有效Short与起始收盘；固定协议和完整输入时间/版本。登记不是预测上涨，只是事先登记30m观察问题。用户不能传registeredAt/return或改期限。关联更正创建新recordId/correctionOf，不覆盖原件。

结果手动核验：未到期返回pending，不虚填；到期无精确连续终点为unavailable且保留；有数据按既有30m简单区间收益追加available，存观察窗口、取得/评估时间、输入bundle版本/方法；同record+input snapshot+状态内容幂等。旧snapshot不会增长，操作者取得获准新快照后重启runner并复用journal，完整匹配原owner/series；登记输入与结果输入各保留bundle身份。原记录永不被覆盖；不同修订来源追加新结果，不能把当前取得版本冒充当时可知。无后台定时核验。

进入Builder前独立GPT契约审查确认上述固定事务/未来取得两项复用风险，并要求明确新快照接续与开收盘坐标；已定稿为以上约束。相应负向测试为必需，不修改既有live gate。

## 允许路径 / 分工

GPT核心：lib/history/{replay,query,protocol}.ts（按必要性最少抽离）、collector/{query-service,research-journal}.mjs及独立research-schema.sql、scripts/history-workbench.mjs；collector/snapshot.mjs仅共享已核验只读打开边界；既有history-workspace.tsx/history-result.tsx接入及局部CSS（必要时）、新增固定props history-navigation.tsx；相关Node/tests/browser/radar.mjs/tests/performance与fixtures；docs/HISTORY_STAGE_C.md/API_CONTRACTS/ARCHITECTURE、主台账/本卡/ACTIVE。不改行情/算法阈值/源policy/认证/monitor或生产绑定。

Node本地runner需加载原extensionless TypeScript图谱；将既有tests/register-types.mjs解析hook原样共享到scripts/register-types.mjs，测试入口只转引。不是新loader框架，不改tsconfig或领域import。到期结果按结果快照自身的精确起止收盘计算同一简单收益口径，原登记起始价独立保留，修订差异不能改写原登记。

DS独立worktree仅固定props历史时点导航展示组件（无网络/金融计算/库/秘密），GPT核完整diff；最多初轮+一次限定修正，失败本地接手。GPT独立Auditor查合同/稳定diff、权限/PIT/全局选择/不可覆盖/实测证据。协调者单写ACTIVE。无新Provider/依赖/框架。

## 验证与停止点

定向Node：流式与原实现等价，跨月/年与页大小、跨页gap/成熟/消重，未来变化隔离、固定版本修订、导航空/非精确/局部维度；journal登记/更正/到期/pending/unavailable/幂等/重启与禁回填；loopback Host/Origin/key/路径/输入上限/失败隔离/取消。B与A专项不修改断言，最终全量/typecheck/build按脚本分项。

浏览器复用五视口harness，保留旧导入用例，新增真实本地SQLite查询fixture路径（非拦截伪造查询）、异步慢旧/新选择、错误保留标识、显式导航建议、研究/记录、手动周期往返、键盘焦点/44px/三档动效。无生产/真机则NOT RUN。

性能沿PERFORMANCE_275：production workerd构建、同机器/Edge/真实时钟/标准动效；同合法2000bar大包基线/候选各桌面与390视口，另候选30000bar本地查询/研究并与报价、滚动/换资产/图表交互组合。记录input-to-visible探针、longtask、heap采样峰值、请求与取消释放；不得用纯函数耗时替代。所有轮次保留，无收益可零优化。若本机条件不可用如实阻塞。

交接时分别判代码/fixture/真实数据/目标覆盖/正式保管/前瞻成熟/生产；B未达目标原样保留。无push/merge/tag/deploy/生产迁移/购数/云调度；完成本批C交接后停止，不称完整2.9真实验收完成。

## 执行交接（2026-10-02）

隔离C1–C4实现/测试完成，真实C研究仍BLOCKED；不将本任务归档成完整真实交付。允许范围内新增app/radar.css局部规则；返回实时沿用hash，无需修改主组件。固定核心指纹8734f1ac3f54cddcf1f945add5e3d5616566d209bd414e9acb6dc2b35010df0e，证据outputs/stage29c/candidate.json。

全量315项/314PASS/1既有Windows文件symlink权限SKIP；Node22最初26专项PASS，追加7项workflow（含新SQLite到期读取边界）PASS；build/typecheck/scopedlint通过。C浏览器9条、旧历史11条、综合工作流/动效48条，五视口桌面模拟。性能基线14轮、最终候选8轮及2视口重叠/取消，原始首次未形成桌面重叠记录保留，未改动产品来制造结果。生产/新CI/真机NOT RUN。

独立GPT审计4项P2（异常URL、跨owner核验、登记来源绑定、保存响应丢失重试）与1项P3（未来建议时间）已修，针对稳定diff VERIFY；2026-10-03独立GPT完成最终交接证据只读终审VERIFIED，无新增confirmed finding；未重跑上述2026-10-02产品测试，未新增DS调用或生产验证。DS实际1次仅固定props导航展示，非算法/数据权限决策。Optimizer未另开：未找到需要性能架构重构的测量瓶颈，既有大chunk警告仍保留。

本地账本/fixture仅隔离保管，真实登记0/真实成熟0，A/B数据和正式外部保管不关闭。报告/操作手册[docs/HISTORY_STAGE_C.md](../docs/HISTORY_STAGE_C.md)，主台账同页索引。无上传/部署/生产变更或后台续跑承诺。
