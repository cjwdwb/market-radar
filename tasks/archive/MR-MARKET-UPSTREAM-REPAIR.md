# MR-MARKET-UPSTREAM-REPAIR — 修复与有限真实复核已完成

## Planner — 2026-11-05

用户在v38交接后明确要求“修复”，继续处理股票429与ETH/SOL代理503。基线main/HEAD fe9f6b2，生产v38/source9710a79/env3；原工作区干净，新分支codex/mr-upstream-repair。旧23/24检查记录不修改，本次不是追认旧失败为成功。market-planner→bounded Builder→相关/集成验证→独立审计/FIX/VERIFY→已授权范围内发布；仅本项目。

目标：修复已确证的取数/代理部署缺陷；有条件时同步现有代理并低频复核。非目标：换数据源、绕限流/拒绝、增加账号/付费、改秘密/访问、数据库/定时调度、AI、金融计算/提醒或降低刷新频率。

## 确证问题及切片

1. Yahoo共享冷却竞态：A/B并发首请求，A先429并建立180秒冷却，B后ECONNRESET；marketJson第二次物理attempt未重查provider冷却，仍fetch。离线mock证明，不能断言这就是生产429根因。Builder允许lib/market-request.ts、lib/market-data.ts及定向tests：每次实际尝试前调用可选provider guard；Yahoo用原upstreamRetryAt检查。保持尝试上限、截止、取消、原费用/频率及错误语义；不跨域回退。测429发生于另一个请求中后，已启动请求的重试与新排队请求均不得再派发，正常传输重试/取消不回归。

2. 独立monitor构建仍使用四文件去import拼接，新market-request/market-history依赖没有进入构建。先做实际离线复现，再修最小构建入口：允许scripts/build-monitor.mjs、独立monitor构建/运行回归tests及必要非秘密说明；不复制lib代码，不添加依赖/新服务/数据库/部署配置猜测。优先使用现有构建依赖合法打包，产物能在真实workerd执行，错误与成功身份遵循同一lib契约。不因此默认远端正在运行该产物。

两个Builder独立worktree无重叠路径；ACTIVE协调者单写。不得扩大为新代理框架或整站重构。接口先固定后整合，独立Auditor审计最终稳定diff。

## 真实权限与诊断

Sites原站点已确认v38/public/active。配置只核对原MONITOR_URL指向本项目既有Cloudflare Worker；MONITOR_TOKEN由平台隐藏，不读取其他项目秘密，不输出/写入凭据。当前未发现Cloudflare专用环境凭据；可用现有官方CLI检查授权状态，核对实际Worker与资源后才讨论部署，不新建/改绑定或调度。普通Sites发布不能替代独立Worker更新。缺少管理会话则只阻塞远端更新，继续本地修复。

本次线上诊断先读日志。若需取数，只在上一明确Retry-After已过后，对同一个原入口做新低频观察；不因失败换身份/地址。冻结最多10个外层非静态请求、1MiB行情正文、60秒、每资产一次，无自动重试。入口/重定向计数、cookie仅内存；403/429/明确拒绝停止该来源。本批与旧生产记录分开，未运行不预填PASS；不对生产注入fixture或触发监控/通知/写入。

## 验证与交付

先受影响Node与真实monitor构建/隔离workerd，再合并稳定版本build/typecheck/fullNode、相关Worker与浏览器；旧771项不是新测。新Node/依赖未引入。性能只验证请求次数与原截止，没有测量瓶颈不进入Optimizer。审计检查取消/共享冷却/重试上限、构建依赖闭合、鉴权和旧业务零变更。

分开报告：源码修复、Sites发布、独立monitor是否更新、真实股票/ETH/SOL结果。无远端权限或来源仍拒绝保持BLOCKED，不宣称全部恢复。不将代码可运行代替生产实际成功。开发DS/产品模型默认0，本次不新增外发。

## 执行与审计发现

- 第一轮新真实preflight仅3次GET/13603bytes：正常入口303、ETH原生15m仍site502/proxy503、NVDA Yahoo有效报价200且session=closed（来源报价时间为真实前收盘，不伪刷新）。没有重试/换源；旧429不追认为通过，当前仅单一股票恢复取数。记录outputs/upstream-repair/preflight.json；本批10次总上限还余7，若实际部署则另记新版本的有限复核。
- 本项目独立Worker官方授权使用隔离Edge；用户主动完成账户验证，WRANGLER的XDG配置限定本项目ignored outputs/upstream-repair/cloudflare-profile，不修改全局或其他项目。首次未完成已关闭，用户要求重新打开后启动第二次。暂无管理授权成功证据。
- 首个Yahoo修复8412f0b加入beforeAttempt，但独立Auditor同轮settlement复现：A已观察429，外层catch尚未发布冷却，B reset重试仍先派发。P2确认，交原Builder FIX：HTTP429被观察时同步登记冷却，再保留attempt guard；加不await A完成的竞态回归，不能弱化断言。
- monitor构建切片594ba37（原00404a3）：现有Vite独立依赖图，关闭网站config/env加载；产物workerd8项通过，独立Auditor重跑8/8。没有部署该产物，远端503原因仍未确证。

## 稳定候选 2cb3503

Yahoo同轮竞态FIX fba6cbf（原e85cf34）经独立Auditor重新复现及30项测试VERIFY；监控产物8项独立VERIFY，两个切片合并后内容一致，无未解决confirmed finding。审计不代表来源恢复。

本地Node24.22.1新测：`node node_modules/vinext/dist/cli.js build`、`node scripts/build-monitor.mjs`、`node scripts/typecheck.mjs`均PASS；分项Node全量784项，783PASS/1Windows文件symlink权限SKIP。`tests/reliability-runtime.mjs dist outputs/upstream-repair/runtime.json`实际workerd23PASS，外部网络全部隔离。5修改文件eslint与diffcheck通过。server SHA256 `05ceb9e7752bbe2433d18c086d7292dbd731055678ebf733e5cc2cd847c1f668`；独立monitor SHA256 `b604834a74f90935bc853bf23920c4aa0b9b68a3706ab4cbdb96bcabd9f2dc43`。浏览器、远端CI和发布状态待实测续记，不预填。

用户在自动化登录窗口遇到Google“不安全浏览器/应用”提示后，已停止该登录方式；按用户Google Chrome偏好改为无自动化控制的普通Chrome、项目独立profile和官方OAuth页面。没有关闭证书或安全校验、伪装浏览器或绕过拒绝。真实登录/授权尚未确认，独立Worker仍未更新。

## 已授权远端修复 — 派发前冻结

上段为当时状态；随后普通Chrome官方OAuth成功。只读管理API核对原market-radar-monitor/market-radar-rex账号与Worker，active version `fb36e1a5-8459-4771-a797-73c365e63c5e`（2026-09-09），远端原模块hash `97c1aa08a00428fea4667fba7ab394e702ff712a8e9bffebfa85da497831d89f`。实际仍是旧全错误503/无条件fallback实现，不能仅由此断言ETH上游错误类型。授权来自用户“修复”及随后官方账户授权；不新增资源/费用/访问权限。

冻结：仅上传已验证45,279bytes独立monitor产物（上述b604 hash）；versions upload继承原DB与MONITOR_TOKEN，保持compatibility_date=2026-09-09/nodejs_compat，上传后及切流前检查新版本实际绑定/运行时；不PATCH非版本配置、不调用schedule写接口、不做D1SQL或/run。原每分钟cron、observability、DB/秘密/设置必须读回一致。旧版本保留可回退。OAuth与实际配置/备份只存本项目ignored outputs，不入Git；每个管理操作一次性锁、不自动重试。

独立Auditor确认runner原先缺新版本资源验证P2，已补assertUploadedVersion并待VERIFY。原生产compat补测因本机workerd最高2026-05-22而未启动（0业务项），明确NOT RUN；不降低生产日期。云端版本上传成功只证明云端接受编译，运行成功需后续真实证据。旧compat离线8项通过保留。

PR#15已合并 `1f4161d84bb7e4266ff2c2406efc20026981d6a9`，PR CI42036095418与main CI42036780803均build/typecheck/784项全PASS，无skip。产品与原审计2cb输入完全相同。五视口浏览器138/138、18截图、0pageerror/0外连，21条预期401/注入503资源日志如实保留；不宣称真机FPS。

原10次应用诊断预算余7，正式冻结部署后两轮成功观察（取代初始“每资产一次”的单次preflight规则）：正常访客入口1，ETH/SOL原15m历史各最多2，合并ETH+SOL报价最多2；首历史均完成15秒且首报价5秒后再观察第二轮。第二轮仅复核成功项，不重试失败；任一OKX429/拒绝停止同源后续。新观察最长45秒，累计正文1MiB扣已用13603bytes；正常来源内部次数另说明，不误称7次均为上游物理调用。未跨完整15m收盘不声称新bar验证。

## 发布、真实复核与收口

独立GPT对修正runner固定hash `397035e894a074cad856bcc1a0eef4b3184dc072c2cd14396991c9842452257d` VERIFY；46文件Sites包无outputs/认证/环境秘密/链接或越界，两个服务端入口与受测dist hash相同。runner的P2已修，产品原Yahoo P2已修；没有未解决confirmed finding。Optimizer未进入，无瓶颈证据；开发DS和产品AI调用均0。

独立monitor实际上传并切流成功：新version `7a16fae6-0fb7-4ba9-a3d5-2b6fda4e6668`，deployment `2435ed6b-534a-4fba-9eb3-13c77e01cc7c`；100% active新版本，原DB/secret绑定、compat、完整observability/非版本配置和每分钟cron读回一致。仅管理API，初次只读6次+上传阶段8次+切流阶段8次；没有D1数据读写/迁移、配置写入、主动/run、提醒变更或新增调度。旧版本保留，不声称原cron未发生其既有业务。

原站已发布 **Sites v39**，源码 `1f4161d84bb7e4266ff2c2406efc20026981d6a9`，version `appgprj_6a9b9dc23584819190a31ae417863e7a~appgver_cc5e79a1efe8819183521a19d5adca3c`，deployment `appgdep_6aec883462a881919304127e716b0134`，2026-11-05 13:44:27 UTC原生succeeded/env3。原网址/访问范围/秘密/关闭的真实AI保持；后续文档提交不再次部署。站点与独立Worker分别登记，不能互相代替。

### 本轮新生产证据（真实数据，非fixture）

2026-11-05 13:44:34–13:44:54 UTC，两轮串行20.409秒、7次外层HTTP/49038新增行情正文bytes；加初次preflight累计10/10次、62641bytes后停止，无自动重试。正常访客入口303，四次history和两次合并quotes全部200。

| 资产/接口 | 首轮 → 第二轮 | 结论 |
| --- | --- | --- |
| ETH-USDT，OKX spot/USDT原生15m | 两轮均96根、0gap/0invalid/0duplicate；fetchedAt 1793886277094→1793886293840；同根未收盘close2391.14→2391.45，volume1076.360307→1084.478464 | PASS：实际重新获取及盘中变化 |
| SOL-USDT，OKX spot/USDT原生15m | 两轮均96根、0gap/0invalid/0duplicate；fetchedAt1793886277508→1793886294460；同根close95.44不变、volume5051.674276→5054.648947 | PASS：实际重新获取及成交量变化；不要求价格必变 |
| ETH/SOL合并报价 | 两资产quote.timestamp和fetchedAt均前进；ETH2391.13→2391.57，SOL95.44不变 | PASS：两轮真实报价更新 |
| NVDA Yahoo | 早先preflight一次200/真实前收盘、session=closed | 单资产取数可用；未验证所有股票或盘中更新 |

两条历史末根开盘均1793885400000/confirmed=false，前根confirmed=true，lastCompleteAt1793885400000；无跨15分钟收盘边界。保留代理attempt/cancellation未知限制。证据为ignored `outputs/upstream-repair/{preflight,post-release,monitor-deployment-result}.json`；不保存cookie或输出密钥。网页真实自动轮询/站主登录后/真机/长期稳定性本轮NOT RUN，不能由接口证据冒称通过；候选本地五视口138项是隔离浏览器证据。

当前约定修复、上传、两处发布及有限来源复核完成。ETH/SOL原503待办在本轮验证范围关闭；旧事故唯一上游根因未被追溯证明、全市场/长时/新bar/真机仍开放。独立GPT最终定向复核六处文档、原始有限结果JSON、版本与绑定回执、归档链接及完整diff，VERIFY，无confirmed finding；生产平台succeeded使用协调者原生回执，未重复发生产请求。继续保留主3.0及历史数据track，不开启AI或扩大来源。
