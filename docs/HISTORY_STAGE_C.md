# 2.9 Stage C — 受控查询、导航与研究记录

2026-10-02。任务 [MR-29-C-RESEARCH-WORKFLOW](../tasks/MR-29-C-RESEARCH-WORKFLOW.md)，唯一覆盖主台账 [MR-29-REAL-DATA-WORKFLOW](../tasks/MR-29-REAL-DATA-WORKFLOW.md)。

**本地隔离代码已实现，真实历史交付仍受阻；不能判完整C或2.9完成。** A/B真实价格仍0条，正式名单、来源保存/研究/展示许可、范围预算和项目外保管尚未落实。既有两条FED宏观元数据不是价格、个股资讯或真实研究样本。本轮没有采集、远程写入、push、合并、标签、部署或常驻调度。

2026-10-03续接：本次仅补最终独立证据终审与任务交接。下方产品测试、浏览器和性能均为2026-10-02实际执行的记录，未在续接时重跑；11个核心文件哈希未变，未新增DS调用、远端CI或生产验证。实际成果继续保留在原工作树；新的空工作目录未迁移或覆盖原成果。

## 基线与本轮对象

- 本地HEAD及本轮只读核对main：`31702c45c653e5e33bac258c110f159d432d5b87`。GitHub CI37004484343成功为该main的历史证据，未运行本轮候选远端CI。
- 分支`codex/mr-29-c-research-workflow`，A/B未提交修改原样保留，C继续为未提交候选。产品文件哈希清单在`outputs/stage29c/candidate.json`；C稳定核心指纹`8734f1ac3f54cddcf1f945add5e3d5616566d209bd414e9acb6dc2b35010df0e`。
- 当前生产仍 **2.8 Foundation P0 / Sites v29**，源码`2ad04ee645ee588b16ede15c43fb093ed395419e`。这是已有发布记录；本轮未重发或验证生产登录后路径。
- 测试对象：Windows10.0.26200/x64、Core Ultra 9 275HX/24逻辑核/约31.38GiB内存、Node24.19.0及22.15.0、本地workerd生产构建、独立Edge149.0.4022.98桌面上下文。所有新增价格为fixture。原始日志和截图在忽略的`outputs/stage29c/`；SQLite夹具在忽略的`work/state27/stage29c-fixtures/`，不是正式保管或用户名单。

## 本批交付和边界

| 对象 | 实际结果 | 仍开放 |
| --- | --- | --- |
| 查询入口 | Radar原历史工作区→本地显式连接→资产/原生周期/UTC日期→分页价格；文件导入/下载保留 | 托管站点真实历史API、真实价格准入 |
| 覆盖 | 固定快照序列目录、实际首尾/条数、研究已检查范围、已见gap及原因未知 | 真实日历完整率、未回补账本与正式名单；首尾不当完整率 |
| 回放 | 原生5m/15m，Short90/Medium180 Direction/RMS；缺精确末根不退回旧bar | 原生日线/小时未取得且无方法契约；历史Relative/Alignment/Transition、Signal生命周期仍未完成 |
| 有效时点 | 前/后实际完整收盘；建议仅最近≤T且需用户点击，无静默改输入 | 有bar不代表方法可分析；状态不足不影响价格可查询 |
| 研究 | 同协议流式遍历、跨页全局选择、200上限；部分遍历无全范围统计 | 真实范围/成熟样本未运行；不降低10样本门槛 |
| 登记/结果 | 独立schema1账本、历史研究/模拟前瞻、更正关联、手动pending/unavailable/available追加 | 真实前瞻0、真实到期0；未启用定时结果核验 |
| 保管 | B固定快照只读查询，journal跨关闭/重开可读；不迁移源库 | B项目外长期备份条件未完成；新journal也尚无正式外部备份 |

返回实时图表使用既有`#price-chart`入口，返回Radar折叠工作区并恢复summary焦点。历史选择不改实时symbol、手动range、自选、提醒或动效。运行中结果与输入草稿分别保存：新输入使旧请求失效，失败保留明确标识的旧资产/周期/T/版本。Short有效、Medium不足、研究不足各自显示，不互相清空。

## 固定查询与执行预算

`ArchiveQueryService`复用B快照验证和A查询。一个会话从校验至关闭都保持readonly SQLite读事务；manifest/hash/schema/事实/时间守卫验证后才准入，不在GET或查询中初始化archive schema或采集。拒绝未来取得，完整bar需`closeAt ≤ receivedAt ≤ snapshot.createdAt ≤ serverNow`。

完整series key包含source、规范资产、币种、调整口径、原生周期、fixture session身份。snapshot用文件hash，不把不同库revision当同一版本。范围为开盘`[from,to)`且`closeAt≤to`，T/asOf单独保留。最大10年选择不等于已有10年数据。

- 单次SQL段≤31天/200根，价格页面≤100根；翻页保持固定快照/序列/范围。空月段显式返回下一游标。
- 研究每次≤120000根、3000页、20秒合作式预算，重作业并发≤2；分页间让出并检查取消。原生同步SQLite语句不是可硬实时抢占的任务。
- partial记录检查终点、计数、预算原因，清空全范围统计；不把最后2000根当多年研究。前端只驻留当前价格页、≤37根依赖和≤200样本，不接收整库。
- 持续研究沿用`same-asset-short90-forward30-v1`。候选成熟/特征/匹配/结果顺序、时间顺序非重叠选择、全局distance排序/top200、最少10和收益单位均未变。rolling window保留跨页依赖；真实gap不插值。

## 研究身份、时间与不可覆盖

新`collector/research-schema.sql`仅用于独立本地journal文件，schema1；不修改archive schema2或monitor。单owner、最多1000登记/4000结果、单记录256KiB/库32MiB。事实表无修改/删除API，SQL触发器拒绝UPDATE/DELETE；参数化事务、正文hash、重试键及输入意图检查。

本轮仅准入`fixture_historical_simulation`、`fixture_prospective`和独立`fixture_prospective_result`。sourcePublishedAt为null、精度unknown，current_vintage不等于严格PIT。保留事实时间、首次取得/修订取得、快照时间、asOf、实际计算/登记/评估时间、规则/协议、输入bundle及版本。不提供伪造receivedAt或过去登记时间的HTTP参数。

登记从本会话可信service重算并验证owner和snapshot。前瞻须Short有效、精确起点存在、输入≤实际登记时间且T+30m尚未到期；只是30分钟观察问题，不是方向预测。更正另建关联记录。请求提交后响应丢失时浏览器保留同一requestKey重试；停止等待明确提示“可能已保存”，不能承诺回滚。

到期由手动核验：未到期pending且不写结果；到期缺精确连续数据追加unavailable/null而非0；有效结果用结果快照自身精确起止收盘算30m简单收益。登记起始价与原记录独立保留，不被后续修订覆盖。不同owner拒绝核验；同结果hash重复执行幂等。

旧snapshot不会产生未来数据。需要实际新结果时，操作者先在获准采集流程取得新B快照，关闭旧会话、用新快照与原journal重开；不自动抓取。新结果保持独立输入hash，不能改原研究。固定旧快照仍须保留才能重现旧研究。

## 本地操作手册（不含真实值）

1. 使用已验证B `archive-snapshot-v1`，指定单owner。输入和journal均必须为`work/state27`内部相对路径；拒绝越界、链接、跨owner、原库schema冒用。journal放在snapshot目录之外。
2. 启动现有本地预览，随后在安全终端环境设置独立`RADAR_ARCHIVE_TOKEN`（24–256字符），不要写入仓库/URL/日志/网站设置，也不要用网站访问码替代。
3. 在仓库根运行：`node --experimental-strip-types scripts/history-workbench.mjs <snapshot相对目录> <owner> <独立journal相对文件> http://127.0.0.1:<预览端口> <查询端口>`。
4. 打开输出loopback网址，通过既有app门禁后，在Radar历史工作区输入本地key连接。key只在本页内存，不入localStorage。页面访问不启动采集。
5. HTTP仅127.0.0.1监听、精确Host/Origin、POST JSON、8KiB正文、no-store，无CORS。归档key不转发预览上游。服务固定代理一个loopback预览，不提供任意URL/SQL/owner/路径访问。
6. Ctrl+C或20分钟上限停止，终止查询并关闭journal/读事务；不是持续云服务。再次手动启动可读原journal。活动登记停止等待可能已提交，应读取账本或用同key重试确认。
7. 固定快照不可被当作可写实时库。B一致备份/恢复继续用[Stage B手册](HISTORY_STAGE_B.md)。journal为另一文件，正式保管需另纳入经批准备份；本轮不声称其长期异地备份已完成，不在线随意复制活跃SQLite主文件。

## 新测验证

命令使用实际PowerShell/Node入口；没有把分项运行称为`npm test`包装命令成功。

| 验证 | 本轮结果/证据 |
| --- | --- |
| 全量Node24 | `node --experimental-strip-types --import ./tests/register-types.mjs --test tests/*.test.mjs`：315项，314PASS/1既有Windows文件symlink权限SKIP；`node-tests.log` |
| Node22.15专项 | 同入口`--test tests/history29-*.test.mjs`初轮26/26PASS，含A/B和C；随后新增真实SQLite结果读取器反例，`tests/history29-workflow.test.mjs`7/7PASS；`node22.log`/`node22-outcome.log`，不把两次重复项相加 |
| 构建/类型 | `node node_modules/vinext/dist/cli.js build`、`node scripts/typecheck.mjs` PASS；`build.log`/`typecheck.log` |
| 受影响lint | 对C组件/领域/collector/runner/新增测试执行eslint，0error/0warning；`lint.log`。CSS无eslint配置，构建校验；不是全仓lint-clean声明 |
| C浏览器 | 现有`tests/browser/radar.mjs`，`RADAR_HISTORY29_ONLY=1`：9项检查记录，五视口及新UI三档动效；`browser-final/verification.json` |
| 旧历史/综合回归 | `RADAR_HISTORY28_ONLY=1`：11项PASS（未额外指定旧版legacy包）；`RADAR_MOTION=1 RADAR_INTEGRATION=1`：48项PASS。`browser-history28/`、`browser-integration/`，合计含C为68条检查记录，不是68次性能采样 |
| 远端CI/生产/真机 | NOT RUN：本轮未push、未部署，无真机测量；不复用旧真机反馈冒称新UI通过 |

浏览器使用`RADAR_SYNTHETIC_AUTH=1`与明确loopback；不读取生产Cookie/凭据。视口1440×1000、768×1024、390×844、320×740、844×390。C包括真本地SQLite（价格本身仍fixture）查询、跨月分页、精确/建议时点、慢旧响应丢弃、错误保留标识、取消、Short/Medium局部可用、键盘/44px、返回手动周期、账本保存/pending。提交后延迟响应→停止等待→重试，两次key相同且记录仅+1。pageerror为空；一条503 console error来自刻意查询失败fixture，不能写“无任何console异常”。

流式研究与冻结的前C实现逐对象比较，5m/15m、缺口、平价、局部数据、9000根全局top200、页1/3/7/127/200、未来改动隔离。独立审计另跑80组固定种子对照全部通过。固定预期未按新实现倒推。

到期机制测试分清：真实执行时间下fixture登记/浏览器pending；显式模拟未来时钟下unavailable；隔离stub结果available追加；另用实际SQLite夹具结果读取器核精确起止价、缺点/来源错配/未成熟拒绝。它们不是实际成熟的真实市场结果，也不是预测有效性证明。综合回归pageerror也为空，console有14次401、7次ERR_FAILED、4次503，分别来自现有隔离monitor/auth、离线/失败用例；旧历史专项无warning，不把这些不同测试混成“全程无console消息”。

## 组合负载与资源

原始首次前后测量`performance/report.json`：同一合法2000根包，1440与390各3轮、基线/候选交替；另30000根DB查询2轮。标准动效、实际推进Date/定时器，不降刷新、不压缩数值、不关闭证据。每轮至少17秒，正常报价轮询继续，包含滚动、图表拖动/键盘和显式换资产；行情响应为隔离fixture，不能代表真实provider服务器延迟。

首轮导入到下一帧可见：基线桌面40.3–43.2ms、手机视口42.7–45.3ms；候选桌面25.8–27.2ms、手机26.3–27.3ms。DB查询615.2–662.8ms。14轮操作起点后longtask>50ms记录均0。不是INP/FPS保证；heap为CDP每秒采样，可能漏过更短峰值。

随后登记幂等UI修复已进入稳定候选；`performance-final/report.json`同输入再跑8轮。导入桌面24.5–25.7ms（中位25.2），390视口27.9–34.3ms（中位28.7）；DB查询分别616.1/602.5ms。8轮操作起点后longtask>50ms均0，pageerror/warning均空；每轮17秒以上，quote请求12、history请求14，原始路径/阶段保留，显式换symbol与正常轮询不记作导航重复请求。CDP采样JS heap峰值候选约22.48MiB，不能代表进程总内存或所有瞬时峰值。DB计算中本地health8次3.0–14.6ms，均实际active=1；真实provider响应仍未测。

另`performance-overlap/report.json`验证实际重叠：先看图表再查询/返回，在1440和390视口拖动开始时服务active=1，正常quote响应发生于查询区间内；随后切资产、取消第二次查询，100ms等待后active/pending均0。首次尝试桌面自动滚动等待至查询结束，不能证明重叠；失败记录保留`first-attempt.json`。后次使用先看图表的明确工作流并等待可见区域而非动画稳定，未改动标准动效/时钟/查询负载，断言未放宽。重叠复测桌面首屏有一条52ms长任务（查询操作前），移动视口无；不能将它隐去后宣称整页无长任务。作业计数归零不代表已证明OS内存立即全部回收。

首次14轮、稳定候选8轮、额外2视口重叠实测分别保留；全部为桌面模拟，不代表真机高刷、正式行情网络延迟或统计准确率。

客户端JS原始总量1067532→1081539字节（+14007，约1.31%）；最大market-radar chunk790028→804035字节。既有500KB警告仍存在。本轮没有据此引入Worker、动态import或新数据库；流式执行是范围正确性与内存上限要求，未发现需要另开Optimizer的可复现主线程瓶颈。

## 独立GPT审计与DS实际参与

独立GPT遵循market-auditor，对固定diff和调用方只读检查；不是主代理自检。已发现并修复：

| 级别 | 问题 | 修复/验证 |
| --- | --- | --- |
| P2 | 未认证非法URL可终止本地runner | 受控解析/拒绝跨origin；原始`/\\[`返400后catalog仍200，独立VERIFY |
| P2 | 核验未绑定owner | evaluate显式匹配owner，跨owner拒绝，独立VERIFY |
| P2 | 登记未绑定分析来源owner/snapshot | 可信service绑定，跨owner/跨snapshot负向断言，独立只读VERIFY |
| P3 | 无previous时建议未来next | 建议只取previous，next仍可独立显式导航，独立VERIFY |
| P2 | 保存响应丢失后重试重复登记 | 保留同意图key、取消写等待如实提示；浏览器提交后故障验证PASS，稳定11文件哈希一致，独立VERIFY |

产品稳定diff独立VERIFY PASS，4项P2及1项P3均关闭，无未解决confirmed finding；2026-10-03最终报告及证据已由独立GPT只读终审VERIFIED：逐文件/聚合指纹、原测试日志、浏览器检查、前后测量及DS调用记录一致，无新增confirmed finding；本次终审未重跑产品测试。没有在FIX阶段新增研究模型或源授权。

DS实际1次deepseek-worker CLI任务（实际deepseek-flash），独立worktree仅`history-navigation.tsx`固定props组件，GPT逐行接收并修正export及控件样式。日志`outputs/stage29c/ds-navigation.log`。未提供真实名单/数据/凭据/完整聊天；未由DS决定数学、权限或最终验收。费用未取得账单，不编造金额。

## 完成判断与下一步

代码/本地模拟验证、真实样例、覆盖、正式保管、前瞻成熟、生产分别判断。C的独立技术切片可交接，真实历史研究仍BLOCKED；A/B分层起点不删改、不静默缩短。当前目录30000根模拟5m、另15m与短样本资产，只用于隔离测量；不是批准研究集合或真实九月/多年覆盖。

没有新增真实行情请求、收费服务或云资源。样例字节/查询耗时可测；账户实际费用和供应商价格消耗未知（本轮价格采集请求0）。新增本地查询请求不等于新增provider请求。没有常驻采集或自动成熟结果。

下一步仅需补既有A/B集中待答的正式集合、来源用途许可及硬预算、正式保管安排，才能领取真实试点；不能靠C UI关闭这些目标。真实数据准入后仍须真实查询/研究、生命周期/来源和成熟结果单独验证。本次完成约定本地交接后停止，未经另行授权不发布。
