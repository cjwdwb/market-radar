# MR-MARKET-LIVE-SOAK

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
