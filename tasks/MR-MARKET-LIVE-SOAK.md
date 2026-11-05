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
