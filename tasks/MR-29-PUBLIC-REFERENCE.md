# MR-29-PUBLIC-REFERENCE — 获准日频线上查询切片

2026-10-03。用户“推进吧”，承接MR-29-RELEASE-READINESS，保留完整2.9范围，条件发布授权不变。当前基线073adc3/codex/mr-29-september-gap，上一轮API与核查diff原位保留。此片实现网站可部署查询能力，不提前发布未完成的完整2.9。

## Planner定稿
现有库：CM-API-SEP2026-002/BTC与ETH/USD/PriceUSD/1d/[2026-09-01,2026-10-01)UTC，各30真实日频值；原始响应/receivedAt/归档hash均已核验，Community CC BY-NC4非商业署名分享用途已明确。只选这批，不扩到五月或新增分钟源/收费/个人自选。原State/分钟研究算法及身份gate不改。

数据契约：新增reference-publication-v1（<=32KiB），format/batch/exportedAt/checksum/两份sources；每source仅asset/raw官方JSON/receivedAt/原archiveVersion。原始响应只含公开asset/time/PriceUSD，无账号/密钥/owner/run/DB路径。复用parseCoinMetricsApi验证源、日期、原始decimal、API provenance与完成日；再算与原库相同的canonical SHA256确认完整版本；不构造Git版本或PIT。外层checksum覆盖所有字段，不当签名。exportedAt为真实执行时间，不重写receivedAt。发布元数据保留署名/许可/来源和筛选说明。新产物存data/published/coinmetrics-sep2026.json，数据库与完整备份仍不入Git。

运行时：新增同源只读GET /api/reference-history，复用现有worker访问门禁/private no-store，不改访问策略。无params仅返回catalog；query严格且仅asset/from/cutoff/version，UTC整日半开、固定范围/最多30日，重复/多余/错误params400，旧版本409，产物非法503。POST不实现（405由router）。无DB/网络/provider/cron。解析一次<=60点的发布快照、返回副本，查询不能改快照。完整数据只在服务端模块，浏览器不加载库。不存在任意文件/host/owner入口。

UI：复用ReferenceHistory。HistoryWorkspace非本机也可在现有折叠区域显式加载“已发布日频资料”，先catalog再固定version查询；loading/error/retry/abort和换资产身份保留，不修改实时选中/手动周期。开发本机也测试相同HTTP路由，不以/__archive替代；原本地工作台入口和导入保持。发布资料与本地连接同类面板需明确作用域，避免选择错库；同一时刻只显示被选择的数据源。按钮触控44px，默认折叠，继续三档动效，无新动画。UI不造金融事实。

安全/成本：只发布获准公共元数据，访问码保持；零新增第三方请求、provider symbols、计时器、付费资源/迁移/存储框架。新增本站HTTP按用户操作，有限catalog/资产请求；发布数据32KiB上限。不把本机正式备份称已完成；可在当前授权工作目录下另存一份只含公开本批的验证备份并空目标恢复，属于项目外同机副本，不冒称异地长期保管。保留期限/异地位置仍须明确。

## 允许路径与实施
scripts/publish-reference.mjs（新增固定批准库→版本数据导出，无网络）；lib/history/published-reference.ts（新增纯校验/查询）；app/api/reference-history/route.ts；data/published/coinmetrics-sep2026.json及data/README.md；components/radar/published-reference-history.tsx（新薄加载组件）及history-workspace.tsx必要接入；相关types仅必要补充。tests/reference-publication.test.mjs、新路由单测与既有tests/browser/radar.mjs新增published分支；不新建browser体系。任务/ACTIVE、主台账及API/CURRENT_STATE/HISTORY_STAGE_A必要文档、outputs/public-reference29/，独立备份副本可写当前cwd的backups/market-radar/CM-API-SEP2026-002（不扫描私人目录、不删除任何已有文件）。

先目标单测：真实文件逐值/版本等价、fixture/额外字段/跨资产/过期version/非法时间/篡改/大body拒绝、有限返回/no-store/非法bundle局部降级；原本地与分钟测试不变。构建/typecheck、全量Node、新HTTP门禁/错误/五视口及旧reference工作台回归。既有browser fixture仅行情/认证，发布历史数据必须来自构建server中的真实快照。记录请求增量与bundle；没有实测瓶颈不Optimizer。

GPT主导数据/许可/接口，DS可按脱敏固定契约给低风险文案/验收草案，不提供raw/用户内容/凭据，不让其改数据含义或自行实施算法。稳定diff独立GPT Auditor（与Builder分开）核对访问边界、版本、身份/精度、请求、UI回归，finding定点修复后VERIFY。并行另一GPT仅核分钟来源官方用途与窗口<=8文档请求，独立证据目录，未准入前不采集。

验收分别写：代码/可部署页面、真实本地HTTP演练、额外同机备份、分钟来源调查、完整2.9未达目标、生产未发布。小片完成继续可执行部分；不能把此片再命名为完整2.9。

Builder必要补充允许路径：components/radar/reference-history.tsx仅增加收起时取消在途查询；DOM/数据/算法不改。DS实际一次deepseek-flash/read-only文字任务，无工具/文件读取；采纳显式加载/局部失败/取消用例和短错误提示，纠正其“目录409”草案（409实际是查询版本冲突），删掉重复长免责声明。日志outputs/public-reference29/ds-copy.*，不以其草案作验收。


## Builder 实施与新测（2026-10-03）
已完成本切片代码与本地真实资料路径，完整2.9仍开放；没有push/merge/tag/deploy。源码HEAD仍073adc3，当前未提交diff包含前轮九月修复与本片；生产仍既有Sites v29/source2ad04ee（平台状态核查见MR-29-RELEASE-READINESS，不是本轮线上功能验收）。

实现：发布包6445bytes、外层checksum 2f67b3f1cb323eeb5ccc166378c51d2e7a461451266e9d7c82e185f86d8ce65e；两序列原archiveVersion不变，60条逐值与真实库一致。显式导出第二次reused=true，无新网络请求/改写。app GET只读服务端包，已有门禁先执行；浏览器只在用户加载/查询时请求本站。UI真实数据不来自/__archive模拟替身。原本机入口及导入保留。仅导出批准公开字段，不发布SQLite、完整账本、个人设置。price string不转浮点、不造OHLC/分钟或PIT。

### 本轮验证
- node --experimental-strip-types --import ./tests/register-types.mjs --test tests/*.test.mjs：357项，356 PASS、0 FAIL、1既有Windows symlink权限SKIP；outputs/public-reference29/node-tests.log。
- 新tests/reference-publication.test.mjs：Node24及最低Node22.15各4/4。首轮测试草案错误使用current-vintage/priceUsd/periodEndAt，依据既有契约修为current_vintage/price/evidenceEndAt；没有改产品数据或弱化断言。
- node scripts/typecheck.mjs、node node_modules/vinext/dist/cli.js build：PASS。Windows单项入口实跑，未冒称npm test/bash wrapper执行。既有500KB chunk警告保留。
- scoped ESLint：8个受影响实现/测试文件，最终0error/0warning；首轮test局部未用解构变量warning已移除。
- 新同源HTTP页面：tests/browser/radar.mjs / RADAR_PUBLISHED_REFERENCE_ONLY=1，在生产构建local workerd（外联拒绝、无远程绑定）+Edge149.0.4022.98，五视口加三档动效10检查PASS。真实已批准日频数据；其他行情/认证fixture；503/409/延迟为局部注入。pageerror=[]，console三条405/503/409均为对应预期拒绝，不宣称“没有警告”。无会话401，登录后POST405；早期使用Playwright APIRequestContext漏发loopback Secure测试cookie导致401，已改由页面本身fetch验证，无产品认证修改。
- 旧本机reference入口：独立loopback workbench连restore-final真实60条，同一harness / RADAR_REFERENCE_ONLY=1，五视口6检查PASS，outputs/public-reference29/legacy-browser/verification.json；pageerror=[]，一条注入503预期console。
- 五视口均1440x1000、768x1024、390x844、320x740、844x390；键盘、44px、默认折叠、无横溢出、旧响应不覆写、503/409保留旧身份、收起取消、返回手动1周周期。截图outputs/public-reference29/browser/published-*.png，主代理查看桌面/手机真实渲染；这是桌面Edge模拟，不是iPhone真机/生产验收。
- 数据加载前本站history请求0，显式目录+BTC+ETH共3次；第三方新增0、timer0。同构建最终热查询5次5/4/4/5/5ms（中位5ms）、响应5328bytes，仅本机隔离HTTP，非生产延迟/FPS。client主chunk812158bytes；此片前同条件bundle未留存，差值NOT RUN，不用历史2.75值假作本片before。无已证瓶颈，跳过Optimizer。
- 外部同机备份：C:/Users/施文唐/Documents/ChatGPT/Market Radar/backups/market-radar/CM-API-SEP2026-002，固定备份10775bytes、两raw和发布包，4个载荷合计22391bytes（不含manifest与32768bytes恢复库）；新空restore-drill完整60条、原版本相同、enabled=false、来源消耗/冷却保留。另一个Node22进程关闭后重开PASS；outputs/public-reference29/backup.json与backup-reopen.json。没有覆盖原库/旧备份，没有启动采集。已有操作系统目录权限，未新建访问控制；仅公共数据。仍为同一机器/磁盘，异地目标、保留期限、容量与负责安排未确定，长期正式保管不判PASS。

### 来源补核与边界
分钟来源GPT独立官方调查：第一批8文档请求，第二批2条款请求；行情0。Kraken具体档案到2026-06-30（原生5m/15m可证），2026-10-01 Global §8/9第三方展示需要事先许可，未获准；CDD正式条款只允许非商业并保留上游权利，首页另禁止原始数据再分发，原生5m/15m未证。CM免费细粒度Reference Rates只有最近7点，不是所需OHLC档案。均不足以批准本项目分钟保存+研究+公开接口；没有绕过拒绝、购买或联络第三方。证据outputs/release-readiness29/source-research/{review,phase2-review}.json。它们的缺口不撤销已批准Coin Metrics日频CC BY-NC4用途。

DS实际仅一次deepseek-flash受限read-only文案/用例草案，无工具、没有原始资料/私人数据；GPT采纳短文案及取消场景、纠正错误“catalog409”。核心代码、来源判断、校验/集成由GPT完成，独立GPT审计另行记录。

### 仍开放及下一批
本片已解决“真实日频只能在本机看”的代码接入，尚未上线。真实原生分钟准入/回放/研究、B长期分层目标、正式名单与预算、异地保管继续保持原目标。当前批准BTC/ETH日频不是完整自选池。真实前瞻成熟结果没有就保留pending/unavailable，不强迫未来成熟。
条件发布授权已记录，但完整2.9未达验收，本片不擅自另发Foundation。下一步只领取许可/范围/预算明确的批次；许可证/上游授权需能支持公众价图及底层读接口，只有“免费展示”意愿不能代替权利。无新采购/生产迁移/常驻调度。


## 独立GPT Auditor产品审查
2026-10-03 stage29c_handoff_verify 只读复核：无confirmed finding；独立930个合法子范围验证全部正确，逐值/时间/版本与原raw和backup相符，首轮9文件（含2测试）的历史指纹811970961827bed23fbee598541fd5e380143dac252f1b43d99c30415e79a841。没有重跑全量/浏览器或冒称生产/真机；文档与外部同机备份已获最终只读VERIFY PASS。

最终产品/测试15文件见outputs/public-reference29/candidate.json，指纹dffdf0f139b7af63eb8b6189414ecb50b87765a3e22c18a36090a90d5581a5a1。收尾期间Auditor指出浏览器补测与旧清单短暂不同步；三档新增用例已实际完成（最终10条）并刷新清单/计数/测量，已针对新固定清单VERIFY PASS。不把首轮9文件指纹当成最终候选。

最终独立GPT VERIFY：15文件hash全部相符；published10+legacy6、全量日志与报告一致；4备份载荷22391bytes SHA/尺寸一致，独立Node24只读重开32768bytes恢复库验证60点逐字段/原版本、enabled=0、请求计数与retry_at保留；Node22异进程证据核对但不冒称审计者重新执行恢复。条款原文哈希与10资料请求/0行情一致。无未解决confirmed finding。两个临时本地验证服务已停止；不承诺后台继续采集。此片本地实现/验证完成，仍待完整2.9条件与后续发布；正式目标不关闭。

## 用户授权澄清（2026-10-03）
用户“获准啊”再次确认自身对免费非商业公开展示/项目推进的授权；该项已经满足，不再索取重复许可。此确认没有指明新的供应商文件或授予主体，因此不改变已核条款事实。已准Coin Metrics日频可继续公开交付；Kraken/CDD分钟缺口明确属于供应商第三方展示条款/数据窗口，不是用户不允许。当前条件发布决定仍有效，不购买、不新增费用，也不自动替换完整2.9为缩减版本。本轮只核既有来源证据与修正文档，无新采集/产品变动，不重跑无变化测试。

2026-10-03后续发布决定：用户确认先发布已验证日频这一批；按MR-PUBLISH-REFERENCE29执行，完整2.9未达目标继续开放，不能将先前条件限制误读为仍需重复发布授权。
