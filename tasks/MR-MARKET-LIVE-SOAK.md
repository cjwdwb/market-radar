# MR-MARKET-LIVE-SOAK

最新续接（2026-11-06晚间）：[诊断修复与Sites v41交接](MR-ETH429-DIAGNOSTICS.md)。已修复跨代理限流类型/真实尝试数丢失并发布原站和monitor；远端各795PASS、独立审计/包装VERIFY。真实ETH预检96根200，随后浏览器4.671秒因ETH429触发停止（含清理总4.874秒），未到ready；受验证诊断为原candles操作attempts1/HTTP429，具体上游规则未知。累计44非静态/65静态及原未知预留均保留，平台协议4已到限，不新增循环探测。真实30min和跨收盘仍BLOCKED，父任务保持OPEN；本地30min两边界PASS不替代生产。生产源码0f977a8，后续文档不重部署。

## Planner — 2026-11-05

用户要求继续验证长时间与跨K线收盘刷新，有问题直接修复。基线main/HEAD a42b95bb929b16e6b4abcca7f677f551876240fd，工作区干净，新分支codex/mr-live-soak。原站原生确认public/active/v39，产品source1f4161d、原monitor7a16fae6；旧CI784PASS和20秒接口成功是历史证据，本轮不冒充新测。

遵循market-planner→真实观察→只有confirmed defect才Builder→相关测试/审计/FIX/VERIFY。主协调者单写ACTIVE。只处理Market Radar，不读其他浏览器私人会话、不改用户存储或提醒、不读凭据、不触发AI/通知/后台采集。

## 冻结观察

- 独立无登录测试浏览器，正常/from-aether入口与原访问边界；新context仅建立测试自选BTC/ETH/SOL、空提醒，不覆盖用户配置。普通production页面与真实时间；不使用loopback fixture harness、假cookie、伪行情或时钟。
- 30分钟前台连续运行，硬截止32分钟。保持原加密quote5s、selected15m history15s、overview60s刷新；只在正常界面选择资产/拖动/缩放/返回，不降低刷新率。
- 只验证BTC/ETH/SOL。默认OVERVIEW包含股票，因此Yahoo请求在浏览器发送前中止并计为EXCLUDED，而非PASS/正常报价；允许局部失败状态。生产不写入任何数据，POST/PUT/DELETE全部拒绝；固定同源/限定GET，不外连任意域。
- 新独立批次最多650实际非静态GET、60静态/10MiB、行情正文20MiB、单正文1MiB；预期30min正常用户crypto负载约540–580次，不额外轮询API或加速刷新。触达任一限制关闭context并停止，不新建批次绕限。任何crypto403/429/明确拒绝立即停止同源；失败不人为重发。预算与旧10/10、23/24分别保留。
- 被动记录请求/返回时间、有限字段、旧/新bar身份、确认、OHLCV/时间序列、quote时间、DOM/chart状态、页面错误、任务计数与浏览器资源采样。Cookie/header/secret不入报告。仅项目ignored outputs/live-soak39保存必要脱敏证据与截图。

## 跨bar与长时验收

源确认：旧bar仍存在且confirmed=true，新bar.time精确等于15m边界且confirmed=false，lastCompleteAt为旧bar结束；不靠客户端时钟确认。96窗口正常退出最旧/加入新根，unique/ordered/900000间隔正确，无无端重复/补值。确认延迟先pending，不强制刷新。quote timestamp和fetchedAt独立前进；价格不变不失败。

默认follow-latest界面应显示新末根，原数据与当前symbol/interval一致；历史视口手动拖开时不得被刷新强拉回，显式最新可恢复。观察原生连续刷新/局部错误展示、正常滚动/图表操作；资源增长和长任务仅报告实测，不以30min证明全天无泄漏/FPS/真机。

允许路径：本卡/ACTIVE、既有可靠性报告、必要只读验证脚本；如复现问题，先补缺陷证据与小范围再允许components/use-market-{quotes,history}.ts、components/candle-chart.tsx、components/use-chart-viewport.ts、lib/{market-client,market-history,refresh-policy,chart-viewport,candle-chart-data}.ts及对应tests。不预先改产品，不改来源/算法/刷新/身份/秘密/权限/数据库。修复发布沿用用户本任务修复授权及既有原站发布范围，先完成独立审计；无缺陷则零产品改动、不重复发布。

审计：独立GPT核对固定diff、真实/fixture身份、请求边界、跨bar/DOM证据与完成结论。缺项如实NOT RUN；30min有限观察不冒称长期SLA。开发DS/产品AI均0。Planner/文档阶段不重复全量构建；有产品修复按风险运行相关及必需集成检查。

## 观察器启动修正

首次启动4.843秒，观察器将Cloudflare浏览器自动JS检测POST误当应用写入而停止；0个行情返回，未证明产品失败。保存原setup-attempt证据不删除。复用既有正常浏览器协议规则，仅允许固定同源/cdn-cgi/challenge-platform/浏览器自然发起至多4次自动协议POST；不手工构造/解挑战、不关闭安全保护，真实拒绝仍停止。应用写请求继续全部禁止。一次限定续接保留首次实际计数（4非静态+1自动redirect、原静态/bytes），总650/60/字节额度不重置；完善自动重定向计数。观察30min从成功加载计，包含启动修正总墙钟不超过35min；未跨入2.0额外任务或来源。

## 真实限流与限定修复

14:01UTC续接首次quote200内三资产均rate_limited/upstream429，BTC history429；立即停止并关闭。0个有效quote/history、未跨bar，不是30minPASS。累计已计非静态11；初次遗漏1条静态redirect和首页/脚本bytes，保留UNKNOWN并为后续预算预留1static、非静态512KiB、静态1MiB，不伪报全批精确字节。观察器在status429立刻关闭前未记录history Retry-After，quote已记录retryAt1793887333116只是已知下限；先补查原日志，不能据此断言所有冷却已过。未经查明不得继续来源请求。

离线Builder发现独立并发缺陷：OKX A/B并行，先settle B传输reset再settle A429，同轮A429状态已被读取但冷却仅在外catch发布；B已排队fallback仍请求另一原有host。反向settlement顺序通过，不能机械照搬Yahoo重复attempt结论（OKX marketJson默认1attempt）。不声称本缺陷导致本次生产429。新增限定允许路径lib/okx.ts、tests/market-request.test.mjs：复用已有onRateLimit在HTTP429观察点同步remember，保持原fallback条件、host、attempt、截止、刷新和业务语义；红→绿并发回归、最长冷却/取消和monitor产物复核。独立worktree Builder后交GPT Auditor；无新源/依赖/权限或预算体系。

既有Sites只读日志补证（未额外取行情）：BTC history事件14:01:13.158Z，stage=proxy、rate_limited、upstream429、retryAt1793887333158，observedAttempts1/upstreamUNKNOWN；补齐比quotes晚42ms的等待期限。安全字段记录outputs/live-soak39/server-failure.json，不保存日志headers。初次被观察器中止的两行情请求在服务器确为200，但浏览器没有读到正文，仍不能算完整成功。

只允许一次在最大已知retryAt再加10min后（最早14:12:13.158Z/北京时间22:12:13.158）原站BTC15m恢复复查；正常访客入口+单history，不换源/账号/代理。仍429/拒绝即结束本轮来源观察，不新开批次。成功只记一次恢复；30min延长观察需先冻结修复/部署实际基线与新绝对截止，全部650/60/字节额度承接并扣缺失预留，不重置。初次35min墙钟目标因来源限流被明确中止，不追认为连续运行；后续累计等待与运行分别报告。

## 修复与最终观察入口 — 14:25UTC

14:13:12–15Z单次恢复探测成功：2个GET，BTC原生15m/96根、0缺口，正文12105bytes；仅该时点恢复，未证明长时成功。累计13非静态、26静态（含漏计补入），保留未知正文512KiB/静态1MiB预算预留。

OKX竞态修复经独立GPT VERIFY，PR#16合并main81d70b12cbb471a8b775d4fa8d4e682ef322f81c。本地build/typecheck/局部lint、786PASS+1已有Windows symlink SKIP、Worker23PASS、五视口138PASS通过；PR远端787/787、main CI42043391413成功。初次本地Node因本项目登录Chrome Cookies文件锁EBUSY失败，关闭本项目窗口后重跑通过；初次浏览器错误预览URL启动失败，修正明确loopback入口后才完成138项，不冒称首次全通过。

独立monitor新version1090fb23-0e86-4538-b82c-ef4012bd2e11/deploymentaf0b87bf-72e2-42d0-b567-fcd3ee259cdc于14:20Z成功，原DB/秘密/配置/cron完整保留。原站Sitesv40/appgdep_6aec91b748ac8191bdaceb31db547fa4于14:25:03Z原生succeeded，source81d70b12/env3/原访问范围。两处上传产物与受测源码相符，经独立包装复核。

最终独立观察计划14:25:39Z冻结（outputs/live-soak39/final-run-plan.json）：只允许14:25:39–14:27:39Z启动，30min从实际图表ready计；实际启动+32min或14:59:39Z二者先到硬停止。承接全部原批次请求及未知字节预留，平台自然协议次数承接、重定向入账；再次来源拒绝即停止且不追加恢复请求。先前两次启动/限流记录独立，不能拼成连续30min。最终观察及边界结果此时尚未发生，不预填PASS。

## 本批实际结果与交接 — 2026-11-05

### 生产观察：未达到长时与跨收盘验收

Windows / Google Chrome 149.0.4022.98 headless / 1440×1000，独立正常访客context，真实时间与真实API；不是用户本人/真机验证。v40实际启动14:27:06.961Z（北京时间22:27:06.961），14:27:11.695Z终止，耗时4.734秒。正常入口303→首页200，BTC/ETH/SOL报价单批200且完整symbol/USDT/OKX身份；同时发起的BTC15m历史429、Retry-After61秒。记录header后立即关闭context；未生成ready、有效history、操作、资源或跨bar采样，不再追加恢复请求。

仅查既有Sites日志补证，未再次访问行情：14:27:12.151Z，proxy/monitor、BTC-USDT/15m、rate_limited/upstreamStatus429、observedAttempts1、upstreamAttempts UNKNOWN、retryAt1793888892171。浏览器/服务端采样时钟不同，不用其中毫秒差推断源延迟。两独立只读复核未发现另一项可证实代码缺陷；不能区分供应商新的HTTP/业务拒绝与既有冷却，也不将quote成功后history429归因于实例分离。已修竞态不被宣称为本次来源拒绝的唯一根因。

| 验收 | 本轮实际结果 | 限制 |
| --- | --- | --- |
| 修复及部署 | PASS | PR#16、Sitesv40、monitor1090fb23；非来源健康保证 |
| v40三资产报价 | PASS（仅一批） | 没有连续刷新样本 |
| BTC15m单次恢复 | PASS（此前v39，14:13UTC） | 96根/0gap，不能移作v40或长时通过 |
| v40历史可用 | BLOCKED | BTC历史429，无有效K线正文 |
| 30min连续前台刷新 | BLOCKED | ready前即遇拒绝，无30min数据 |
| 两次15min收盘/历史锚点保持 | BLOCKED | 无真实boundary/DOM证据；既有本地fixture回归不替代 |
| 长时资源/重复请求增长 | NOT RUN | 运行不足，无资源样本；不宣称FPS或无内存泄漏 |
| 所有股票/站主登录后/iPhone真机 | NOT RUN | 不在本批Crypto只读环境范围；股票请求在发送前排除 |

### 本批累计请求与证据

不与旧v39任务10次或v37任务23次混算；本批三次启动和一次恢复探测保留独立身份。

| 项目 | 已知记录 | 未知预留 | 预算占用 |
| --- | ---: | ---: | ---: |
| 非静态请求 | 19（含补记入口redirect） | 0 | 19/650 |
| 静态请求 | 38 | 1 | 39/60 |
| 非静态正文bytes | 219548 | 524288 | 743836/20971520 |
| 静态正文bytes | 4570402 | 1048576 | 5618978/10485760 |

非静态含HTML/favicon及2次浏览器自然平台协议POST，不全部称行情GET或行情字节；未知预留不是实测用量。HTTP transport/供应商账单和后端全量上游尝试不在浏览器统计内。开发DS/产品AI调用均0；未改通知/自选真实数据、秘密、访问权限或调度。

项目ignored证据：outputs/live-soak39/{setup-attempt,report,recovery-probe,final-report,final-run-plan,final-server-failure}.json；sites-v40-deployment.json及monitor-*-result.json；本地runtime.json、browser/after/verification.json和18张合成截图。没有生产跨bar截图。旧setup含原始自动平台路径，仅本地忽略保留，不上传原始日志、cookie或认证资料。正文统计/源事实是有限采样，不保存用户偏好或私有会话。

### 本轮新测与源码身份

产品fd6cff827bf23bb59588c028565f55063bc31e34整合为main81d70b12；两者产品文件相同。与起点a42b95b相比产品只改lib/okx.ts和tests/market-request.test.mjs，其余任务/文档。server SHA256 115add5f72b9f50593bf16f3d78080c52ee5641877411a5c11b34ef91e18cb9c，monitor a4a7546eb0fb50afb039bdd86fe5af5e6b5d656a9d82ec7330640192d99ac87f。

- node node_modules/vinext/dist/cli.js build、node scripts/build-monitor.mjs、node scripts/typecheck.mjs：PASS。Windows分项执行，不冒称本机npm test包装命令执行成功。
- node node_modules/eslint/bin/eslint.js lib/okx.ts tests/market-request.test.mjs：PASS。
- node --experimental-strip-types --import ./tests/register-types.mjs --test tests/*.test.mjs：重跑787项，786PASS/0FAIL/1已有Windows文件symlink权限SKIP；首次EBUSY记录保留。
- node tests/reliability-runtime.mjs dist outputs/live-soak39/runtime.json：隔离合成workerd23PASS，外网禁用。当前本地runtime不支持生产monitor兼容日期2026-09-09；生产日期不降低，独立monitor已有隔离8项和官方上传编译证据，不能冒称生产同日期本地运行通过。
- node tests/browser/radar.mjs，RADAR_RELIABILITY=after、RADAR_SYNTHETIC_AUTH=1、RADAR_PREVIEW_URL=http://127.0.0.1:5398、RADAR_OUTPUT_DIR=outputs/live-soak39/browser：五视口138PASS、18截图、0pageerror/0external、21条预期合成401/503 console；首次错误URL启动失败不是UI验证。1440×1000/768×1024/390×844/320×740/844×390均为桌面浏览器模拟。
- GitHub PR CI42043031115/job127298533464及main CI42043391413/job127299791271：build/typecheck、787/787PASS、0SKIP，均本轮新测。
- 独立GPT产品修复/包装/观察器派发前VERIFY已完成；最终报告复核另记，不用自检冒充。无实测性能瓶颈证据，不进入Optimizer。

### 剩余条件与停止点

本批按冻结规则停止，生产v40继续运行；不会后台自动重试。此任务保持开放，不能归档成全部通过。继续真实30min/跨两次收盘之前，需原来源恢复可用并冻结下一次有限观察窗口；先利用同一失败请求的monitor安全日志查清新拒绝/业务限流/既有冷却来源，而非循环刷新或换来源绕限。不降低行情刷新、不增加新Provider、不冒用旧成功补齐。

v39/monitor7a16fae6分别保留回退点，当前无证据要求回退已通过的并发修复。后续文档上传不触发新Sites发布；主3.0和独立数据track未关闭。

最终独立GPT Auditor已对a42b95b→81d70b12产品、五文档稳定diff、真实报告/预算/部署回执及隔离测试证据完成VERIFY：无新增confirmed finding；BLOCKED/NOT RUN结论、实际计数与未知预留一致，outputs/认证目录未纳入Git。未执行额外生产请求。仅文档提交上传，不再次部署；本任务的来源恢复与长时/跨bar验收继续开放。

## 2026-11-06 用户要求自主补齐 — 新的有限观察

Planner重新核对：本地/远端main d640424e9c5c07f8fcf7f83345ebb5ae7e97a9d1，工作区原干净；Sites仍public/active/v40，产品81d70b12，无新产品部署。旧批次全部结果和19次非静态消耗保留。距离上次拒绝已超过14小时，不再沿用已结束的自动重试链；用户本次明确要求补齐授权一次新的有限验证。

先单次正常/from-aether入口及BTC15m检查，最多2请求/128KiB、20秒超时，无重试。如果仍429/拒绝，停止本轮行情访问，利用已有日志诊断；不改账号、域名、来源或轮换身份。若成功，接续同一计数账本的独立正常浏览器30分钟前台观察，实际启动+32min硬停止，开始前冻结绝对时间。保守承接昨天全部预算占用（19非静态/39静态/743836非静态bytes/5618978静态bytes/2平台请求，已含未知预留），总上限仍650非静态、60静态、20MiB非静态正文、10MiB静态、4次自然平台协议POST；加入今天2次探测，不重复增加未知预留，不再追加恢复试探。

同原验收：BTC/ETH/SOL；ETH界面跨两次15m，第一次追随新bar/前根源确认，第二次历史视口锚点保留及回最新；默认正常5s quote/15s selected history/60s overview，不降低频率、不放入fixture。股票未测，外发前拦截并明确EXCLUDED；真实源拒绝立即停止；生产不写用户数据、不访问私有会话/凭据、不调用AI。

04:39:20–23Z的2次有限探测成功：BTC96根连续原生15m、0gap/invalid/duplicate，12131bytes；不单独算连续观察。独立GPT VERIFY新observer92c4054f，承接累计21非静态/39静态起步；补全两次来源确认、quote结果集合/数值/时间身份、UUID trace白名单。固定窗口04:41:46–04:44:46Z可启动，绝对最晚05:16:46Z，实际启动+32min更早则先停。

实际Chrome148.0.7778.217（Windows headless，桌面1440×1000），04:42:33.331Z启动/04:42:39.178Z ready，目标05:12:39.178Z，实际硬截止05:14:33.331Z。预计04:45/05:00两个真实15m边界。截图使用真实生产数据；股票源排除明确造成局部待更新，不能称全市场通过。最终另外核对全部样本前台、两次来源/DOM证据、逐资产quote timestamp/fetchedAt及history fetchedAt前进、请求间隔/数量/错误与资源采样；OBSERVATION_COMPLETED只表示到时，不能单独代表验收PASS。没有longtask observer，不报告长任务次数或FPS。

先只改任务/ignored观察记录；沿用已审查observer，修正仅限本批身份、时间/计数、准确断言及更完整的安全错误取证。独立GPT复核观察器与结果。若确证产品问题，按原allowed paths小范围修复/回归/独立审计；无缺陷不改产品、不重复全量测试或部署。前次本地787/138/23为历史证据；新真实结果单独记，不能补成旧批次PASS。来源仍不可用时继续可执行的隔离检查，分别报告，不冒充线上长时通过。

### 本轮来源再次拒绝；隔离长时补证范围

04:42:33.331–59.477Z生产总耗时26.146秒：BTC/ETH/SOL各一次96根连续15m，quote4批按约5s推进；ETH第二次15s刷新429/Retry-After60。图表ready为04:42:39.178Z，停止04:42:53.971Z，实际ready→stop14.793秒；后5.506秒为关闭清理，不计有效观察。及时停止且不再探测。安全trace 2af78832-2198-4664-b93c-beda0ac73ab9与Sites既有日志匹配，proxy/monitor/429、observedAttempts1/upstreamAttempts UNKNOWN；未证实新的产品缺陷。原30min/真实跨bar仍BLOCKED。

报价三次请求间隔5000/4995/5000ms；BTC/ETH/SOL quoteAt分别前进14553/14579/14500ms，fetchedAt均前进14982ms；ETH两次history请求间隔15010ms。生产只有1个DOM采样，不能做长时资源结论。新增已知非静态14次（2探测+12浏览器）、静态13次；承接原账本后非静态33/650，静态52/60（51已知+1预留），正文899018bytes（374730已知+524288预留），静态7155893bytes（6107317已知+1048576预留），平台自然POST累计3/4；不把未知预留当实测流量。单次股票请求EXCLUDED；0pageerror，console为股票排除和429各1条。管理日志查询另外2次HTTP（401/403），官方CLI内部请求次数未观测；实际供应商费用UNKNOWN，开发DS/产品AI均0调用。

继续可执行补证：批准在现有tests/browser/market-reliability.mjs内增加一个可选wall-clock soak入口及必要tests/browser/radar.mjs接线（不得改产品）。复用生产构建、Miniflare、本机fixture/浏览器/选择器；只loopback、浏览器外网和Worker外网双重拒绝、合成凭据。正常Date.now/30min真实经过、不安装或快进page.clock；行情是明确合成的、按当前UTC15m格生成96根，旧完整/新未完整、窗口滚动，无生产数据混入。auto=true/backgroundTabs=false/standard motion；保持正常刷新频率，测试自选3crypto，股票fixture可明确排除。以两次自然15m边界做同样跟随/历史锚点/回最新；记录请求时间、所见更新时间、DOM/heap/任务累计和错误，结论只能证明本地前端/构建运行，不证明provider/代理持续健康。

固定总32min/650本机非静态请求/60static/20MiB数据，失败即停，所有外发0；不重跑全产品测试。独立worktree Builder实现并做短启动自检（自检不计30min），独立GPT检查网络隔离/时钟/身份/断言后才执行30min。主协调者仅文档索引写入；合格测试代码可在审计后整合，不发布新产品版本。旁路只读既有monitor日志限定同script/同失败时间窗，不改日志设置、不触发上游请求。

代理日志旁路实际结果：仅market-radar-monitor、04:42:30–04:43:05Z、最多20条的官方历史日志查询，过期OAuth返回401。使用原项目忽略profile的官方Wrangler whoami完成正常续期（不新增登录/scopes、不读取其他配置/账号），同一只读查询仍403，随即停止；没有换通道或扩大权限，没有触发Worker业务请求。只有Sites安全失败日志可用，monitor具体新HTTP拒绝/50011/既有冷却仍UNKNOWN。官方API参数参考Cloudflare SDK文档，本地原始响应未保存，仅允许字段和HTTP状态。

隔离Builder提交0d89fdf整合为ed59e981d7967849c5b881da0835b5c115ecac47，只有两个browser测试文件+独立卡（见[隔离验证归档](archive/MR-SOAK-ISOLATED-VERIFY.md)）。独立GPT派发前VERIFY及固定hash短测PASS；原产品0改动。主协调者对新工作树的几次命令被工具中断（未执行），未据此改权限；按正常Builder提交/主分支整合后在原工作目录执行已恢复，不能将中断算产品失败。

正式本地检查04:57:21.448Z启动/04:57:24.147Z ready，目标05:27:24.147Z，硬截止05:29:21.448Z；Chrome148.0.7778.217、1440×1000、原生时钟/可见性、正常频率/标准动效、显式合成行情，预计05:00/05:15Z两边界。outputs/live-soak40-nov6/local-plan.json先冻结，local-30min/soak/verification.json记录进度。server hash仍115add5f...cb9c与v40相同；源输入为fixture，不是本次生产捕获或真实源恢复。结果等待完成和独立复核，不预填PASS。

结束前冻结离线持续性守卫：核对完整ready→end窗口及首尾空档，quote名义5s/选中ETH history15s/BTC与SOL overview60s；本机无网络fixture允许最多一次错过计时器周期+1s调度裕量（分别11s/31s/121s）。超过则需调查，不能只用首尾时间推进宣称连续PASS；这不是生产SLA。RUNNING只记PENDING，在途单列；结束后另核对两次ETH原始旧/新根确认及lastCompleteAt。统计响应延迟仅指观察到响应头，不冒称完整body下载延迟；标准中位数/nearest-rank p95；quoteAt/fetchedAt推进分别计算。该分析不改变运行中harness、数据、刷新或阈值。

### 2026-11-06 最终本地补证（新测，与生产分别判定）

正式命令见隔离卡：root `reliability30` 运行既有 `node tests/browser/radar.mjs`，`RADAR_RELIABILITY_ONLY=soak`、合成认证、loopback5399、原生产dist及Chrome；本轮只运行一次正式30min。05:27:24.274Z正常结束/exit0，总1802.826秒、原生前台1800.020秒；UTC05:00和05:15两次自然边界，不安装时钟或页面可见性替身。报价与K线为合成输入，不能证明真实供应商持续服务。

| 新测项 | 结果与证据 |
| --- | --- |
| 30min前台/同资产/时间推进 | PASS；91个DOM与资源样本、始终ETH/visible，无横向溢出；三币quoteAt/fetchedAt及history fetchedAt均推进、无回退 |
| 旧根确认/新根追加 | PASS；ETH两次分别在边界后7.643/7.630秒的正常轮询取得；96根无重复/补点，旧根confirmed、新根未收盘、lastCompleteAt及间隔一致 |
| UI跟随/历史锚点/回最新 | PASS；首边界显示新根且可查看前根确认；第二边界保留44根视宽和01:00UTC绝对锚点，显式End恢复最新05:15，结束仍follow=true |
| 刷新持续性 | PASS；361批quote、183份history；全窗口最大间隔quote5015ms、ETH15013ms、BTC60011ms、SOL60010ms，均通过结束前冻结守卫；没有通过降频达标 |
| 网络/清理 | PASS；547非静态/11static，3372638正文bytes/1494366静态bytes；浏览器及Worker外发0，pendingAtTeardown0/maxPending3；股票27次EXCLUDED，不计行情成功 |
| 页面异常/截图 | PASS；0pageerror；27条预期股票blockedbyclient console（不是零console）；6张合成截图，首/二边界及结束已视觉检查 |
| 资源观察 | 91样本：JSHeapUsedSize min9886100/max16164916，首13195520/末11258412bytes；DOM首2954/末1773，listener首1585/末1027。未见本窗口内持续积累，不宣称无泄漏/FPS/真机/全天通过；TaskDuration仅累计任务耗时（秒） |
| 新完整构建/全量Node/五视口/真机/远端CI | NOT RUN；产品文件与v40相同，仅新增测试入口，复用前次787远端/786+1本地、build/typecheck和五视口138的历史证据，不计本轮新测 |
| 生产30min/真实跨bar | BLOCKED；仍为上方真实14.793秒ready→限流停止；本地PASS不解除该项 |

`outputs/live-soak40-nov6/local-analysis.json` 的13项完整性检查全部true，身份为LOCAL_SIMULATION_PASS；分析脚本仅离线读取报告，修正经独立审核，未改运行数据。正式证据在`local-30min/soak/verification.json`，原生产证据为`final-report.json`、`safe-site-failure.json`；这些均在项目忽略目录，不上传原始记录/凭据。无新增产品缺陷，因此零产品改动、不进入Optimizer、不重新部署；Sitesv40继续运行，父任务仍OPEN。

独立GPT Auditor已从原始报告另行复算VERIFY PASS（仅本地合成）：91样本最大间隔20.554s、浏览器与采样时差1–3ms；全部6个三币边界、两次ETH界面、44根历史锚点、首尾在内的刷新间隔、547请求与字节总和、零外发/清理均一致；查看3张关键截图。测试/analyzer hash不变，无新增confirmed产品finding。审计另校正生产有效观察时间和本地截止描述，已修正文档；没有额外浏览器或来源请求。

## 2026-11-06 晚间继续真实恢复 — Planner

用户再次明确要求解决线上ETH429并完成真实长时/跨bar，有问题直接修复。09:13UTC重新核对：本地176b243、github/main仍d640424；工作区原干净，Sites仍public/active/v40，产品81d70b12/monitor1090fb23。旧本地合成PASS保留，不能替代生产。近120分钟Sites既有错误日志0条仅表示未取到事件，不证明来源健康；未重新请求之前403的monitor日志接口。

距离上午来源拒绝超过4小时、旧retryAt已过。先只允许正常入口+ETH15m的2请求恢复检查（128KiB/20秒/0重试），以当前用户的明确继续授权开展，不换来源/身份。若成功才冻结一次30min真实浏览器窗口/实际启动+32min硬停，保持5s/15s/60s频率、crypto3币范围和正常访客身份；任何来源429/403仍立即停止。不循环探测，不用新的runID绕过来源拒绝。

沿用累计已用33非静态/52static（含1预留）/899018正文bytes/7155893静态bytes/3自然平台协议POST，不清零；市场及总正文上限仍650非静态/20MiB，静态仅因新独立浏览器须加载现有构建而由60增至80，静态10MiB不变，平台自然协议4次上限不变。新增两个恢复请求先入账，若后续预算不足则停止；不是新增来源调用额度或轮换身份。

并行独立GPT只读调查已确认诊断信息丢失：monitor typed失败未写结构日志，HTTP429/business50011/已有冷却在现有包络中无法区分；目前不是已确证的来源限流根因。若新恢复失败，停止行情请求，Builder可限定补充诊断链：lib/market-request.ts、lib/okx.ts、monitor/worker.mjs及对应tests/文档，必要app/api/history/route.ts调用。仅受控枚举、计数、时间与既有trace，无响应正文/URL/凭据，无任意诊断读取接口；不改变来源、冷却阈值、刷新、访问权限/数据库/秘密/cron或金融语义。接口定稿后才Builder；新修复先隔离测试及独立审计，再沿用本任务原站修复发布授权。当前先不写产品代码。
