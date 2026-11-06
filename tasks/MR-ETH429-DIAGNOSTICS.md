# MR-ETH429-DIAGNOSTICS — 受限诊断与真实恢复

## 最终交接 — 2026-11-06，诊断已发布；来源恢复仍开放

[PR#17](https://github.com/cjwdwb/market-radar/pull/17)正常合并，源码`0f977a804c72c0792620db5ad850192c0fa1b287`。PR CI42197164267及main CI42197401480均build/typecheck/795项全PASS（Linux无Windows skip）。独立产品、测试修复、证据与包装VERIFY PASS。包46普通文件/13目录、仅dist；45文件逐字节一致，hosting仅等价序列化。包2052478bytes/SHA256 `562cb7be2b6a3d32d1831cb861decf1cb82257f6eb109aa08e00a8e53616e52c`。

原monitor于09:47:59UTC更新：version `1fefe72d-1b8d-4b7a-a00a-91bcd5128fcc`，deployment `de956c4b-8014-4759-b00c-fed633187b35`；上传8/激活8管理请求，与下述只读GET4分列。前后DB、secret绑定、兼容性、settings和cron一致；未重试被403拒绝的日志入口。原站**Sites v41**于09:49:28UTC succeeded/env3，version `appgprj_6a9b9dc23584819190a31ae417863e7a~appgver_d59c5cd39a248191aa3f498a7863ac09`，deployment `appgdep_6aeda2a1d0dc8191a24c23ebc88f6f0b`。原站受众/访问/AI不变；v40及monitor1090fb23保留为回退点，未移动标签。

| 真实检查 | 本轮结果 |
| --- | --- |
| 09:49:35–38UTC预检 | 正常入口303；ETH15m200、96根、0gap/invalid/duplicate，旧柱来源确认/新柱未完成；2请求/12126正文bytes。只是当时成功。 |
| 09:50:20独立Chrome148观察 | 启动后4.671秒因ETH429/Retry-After60触发停止，总运行4.874秒（含0.203秒清理）；三币一批quote200、BTC历史96根200。未到ETH ready，30min前台计时未开始，没有跨bar。0pageerror、1条范围外股票拦截/1条429 console。关闭context后的等待取消不是另一个产品缺陷。 |
| 失败定位 | trace `703e611b-1866-49a8-8601-1eaccdf814eb`，validated monitor；kind=http、endpoint=candles、httpStatus429、attempts1。原操作只尝试一次即收到上游HTTP拒绝，未在该操作内重试或换端点。不是仅本地cooldown或HTTP2xx业务映射；HTTP429正文未读取，不能断言正文不含50011。 |
| 日志与复核 | 停止来源后只读Sites日志：先errors_only，再为固定warn结构扩大；仅保存白名单诊断。独立GPT检查实际证据和调用：cron走getQuotes(false)，共享ticker不取history；未见本次candles放大或新增可操作产品缺陷。attempts1不代表其他实例/全站/出口总量，具体来源限流机制UNKNOWN。 |

累计44非静态/65静态、正文1026619bytes/静态8692529bytes、平台协议4；其中原未知预留512KiB正文/1MiB静态已计入，不冒充实测。本轮新增11非静态/13静态、已观察正文127601bytes/静态1536636bytes；拒绝正文未读取，未知不填0。平台协议额度已用完，不换run重置。真实观察计划和证据在本项目忽略目录`outputs/live-eth429-nov6-evening/`，包括deployment-receipt、monitor-deployment-result、postdeploy-preflight、final-run-plan/final-report、production-diagnostic及本地报告；不提交实际行情/凭据/原始日志。

诊断缺陷已修复上线；**ETH持续429未解决，真实30min/跨收盘BLOCKED**，父任务OPEN。现证据不支持猜测IP封禁、增加缓存或降低刷新。下一步需原来源/托管方说明该UTC时间与endpoint的HTTP429触发原因及正常接入条件，或有既定链路恢复的外部证据后另冻结有界复测；不轮换账户/域名/出口绕限，不自动外发工单或持续探测。官方candles文档当前标40次/2s、按IP，并不能证明本项目触及该规则，也不是低于它必定成功的保证：https://app.okx.com/docs-v5/en/#order-book-trading-market-data-get-candlesticks（11/06文档检索，非行情请求）。

本轮DS/产品AI0调用，无新订阅/资源；供应商/托管实际费用UNKNOWN。Optimizer无测量瓶颈，跳过。真实长时/跨bar/真机不写PASS；下文保留开发与发布前时点，文档收尾不重新部署。

父任务MR-MARKET-LIVE-SOAK；2026-11-06晚间，基线176b243，产品Sitesv40/81d70b12、monitor1090fb23。用户明确继续修复线上ETH429，沿用原站修复发布范围。独立GPT只读审计确认typed monitor错误缺少结构诊断且跨代理丢失businessCode；没有证据确认重复刷新或供应商限流根因。

09:15:23–26UTC单次恢复：正常入口303、ETH15m429/Retry-After61，trace9d4fb37f-2ae2-49be-a96d-89e99f4dcbf2；2请求/206正文bytes，立即停止，无长时浏览器。累计35非静态/52static、899224正文bytes/7155893静态bytes、3平台协议；未知预留照旧。不是新的来源额度。管理日志历史403不重试，不换访问路径或请求权限。

## 冻结最小契约

- 只补诊断，不声称这能解除429；来源、频率、冷却/最长Retry-After、取消、重试次数和回退条件完全不变。
- `MarketRequestError`可增加内部typed `rateLimitDiagnostic`：kind=http|business|cooldown、实际httpStatus（http=429；business仅可记录真实捕获的2xx，否则省略；cooldown没有虚构HTTP）、businessCode仅50011、endpoint枚举candles|history-candles|tickers|ticker（未知省略）、实际上游attempts安全整数0..16、observedAt真实安全毫秒。HTTP诊断在观测HTTP429时冻结；50011在业务校验时冻结；cooldown在拒绝派发时记录。共享请求用真正操作scope计数，不把加入等待者的0误称物理请求0。
- 公开`errorInfo`/errorResponse维持原协议，不向浏览器新增诊断。仅monitor已认证/history错误包络可带版本化、固定字段diagnostic，旧代理无此字段仍兼容。不得添加公开日志读取接口。
- Sites仅在已有标准monitor错误包络通过严格验证后，接受上述字段；额外/非法/不一致字段不得进入诊断（也不影响既有HTTP错误与冷却）。远端自由文本/trace/stage/URL/headers/正文不传递。内部来源身份local|monitor由执行路径确定，不由远端自由传入。
- `recordMarketFailure`只记录验证后的固定诊断，保持旧字段语义和UNKNOWN，不用代理外层1次冒充上游1次。monitor/history捕获点调用受限结构日志；不记录数据库设置/自选/提醒/Token。
- 新HTTP/业务/冷却信息不能影响金融事实、返回状态、预算、取消、重试与授权。未知来源保持UNKNOWN，不能凭成功报价推断代理健康。

## Builder允许路径与验收

独立worktree/branch，仅lib/market-request.ts、lib/okx.ts、monitor/worker.mjs、tests/market-request.test.mjs、tests/monitor.test.mjs；若调用或runtime验证确实必要，app/api/history/route.ts和tests/reliability-runtime.mjs可最小调整。不写ACTIVE、不改其他worktree/用户文件，不读取生产凭据/网络/部署。无需新依赖、配置、数据库或Provider。

测试用隔离mock/明确时钟：真实HTTP429与200/50011区分；后续cooldown0新派发；共享错误诊断操作计数；monitored诊断合法/非法/未知字段/旧无字段/与状态不一致；公开响应不泄露；最长冷却/取消及原并发回归保持；结构日志字段无注入。先受影响Node/lint，协调者稳定候选做build/typecheck/full Node及workerd相关验证。Builder交红绿证据、完整diff/commit及剩余限制，不宣称生产已修。

GPT Auditor先核对契约/稳定diff及来源拒绝边界；有finding交Builder FIX后VERIFY。必要发布只更新同一Sites和monitor，保留秘密、权限、绑定、调度；部署须等现有冷却已过，不把重启用作清除冷却手段。之后只安排一次冻结的真实检查，继承所有计数；仍429则取本次安全诊断停止，不绕限或循环重试。若证实应用缺陷再局部修复；若确属供应商拒绝则报告可证明层次及所需条件，不承诺完成不可达的30min。

## 实施/验证进度

独立Builder a6b304e整合为89227a6；只改3个产品文件及2个test。相关50/50、局部lint0error/1既有monitor default-export warning。首轮新增测试的mock时钟跨用例污染造成1失败，修正测试隔离后通过；没有baseline红测，不写红绿已跑。独立GPT审计固定5文件无confirmed finding，另以纯内存monitor→Sites真实handler串联HTTP429与HTTP202/50011，两例及后续0派发冷却PASS，外网0。

协调者已运行新build、monitor bundle、typecheck及全量Node：795项=794PASS/1既有Windows symlink权限SKIP。首次typecheck只因上轮ignored目录保存的官方SDK参考.ts被扫描，原样改名.txt、hash不变后重跑通过；没有改tsconfig或压低检查。五视口和新增workerd诊断验证等待完成；不将旧报告移为本轮PASS。

管理环境：09:22UTC原项目官方CLI会话续期成功，无新登录/scopes；09:24:10UTC仅同一monitor的GET deployments返回503，0变更。已有403历史日志接口未重试。冻结一次同路径管理复查，最早09:34:11UTC（间隔10min），累计最多4个GET（已有1+deployments/settings/schedules3），任何失败停止、不换账户/通道，不改访问权限；503重试是管理状态读取，不触发行情或部署。旧首次响应未保留Retry-After，记录此限制，不冒称已知服务恢复。

最终本地验证（11/06）：五视口138项、18截图、0pageerror，21条预期合成401/503 console；Chrome148桌面模拟，不是真机。workerd首次22项中日志采集断言失败，原报告保留；产品已输出正确诊断，但测试错误使用Log.warn收集runtime stdout。改用Miniflare公开handleRuntimeStdio，限定8KiB行/4条白名单诊断/1s等待；最终24/24PASS，17mock代理+1mock直接、0真实来源。对应提交1651379→73e0efe→e1e0f12；没有改产品以迎合测试。完整Node795项=794PASS/1既有Windows SKIP、build/typecheck/受影响lint均通过。

独立GPT审计：产品89227a6 PASS；真实handler纯内存HTTP429及HTTP202/50011、随后cooldown零派发补测PASS。最终e1e0f12的runtime测试修复及证据VERIFY PASS，无confirmed finding。Optimizer无实测瓶颈，跳过；无DS/产品模型调用。稳定产品hash：server a016786d8ffc2a0d6e7e688a5894ee3fe7e9e68785c21d82a4242ed9603f56b2；monitor 07eff6bfa2491207eff591ae2123e3632606717ec421367d038d6190f0222aa2。

09:34:38UTC管理复查成功，原version1090fb23、settings/schedules均未变化；累计4个GET/0变更。允许按既有原站修复发布范围更新诊断；生产仍v40，ETH恢复/真实30min仍BLOCKED。后续一次探测继承35非静态/52静态、正文899224bytes/静态7155893bytes及未知预留；静态次数上限60→80仅用于新的独立浏览器现有资源装载，静态10MiB/正文20MiB/非静态650不变，供应商预算不增加。出现429立即停止，不循环重新开始。
