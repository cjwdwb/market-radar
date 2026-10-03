# MR-PUBLISH-LONG-REFERENCE29 — 长期日频网站交付与发布

2026-10-03，GPT Planner。用户“弄吧”承接“先将已经完成的五年日频接入网站并上传部署”。授权该切片的本地实施/验证、GitHub正常PR/CI合并与既有Sites发布；不购买分钟源、不改变访问码/受众、数据库或调度。原长期归档、五月/九月成果及未提交diff完整保留。

## 基线与目标

main重新读取仍da1b2ed33f067dc65600ab0d3e256a64046e6e26；Sites原生active/v30/public/owner，automations=[]。官方workflow已在现独立coverage29工作树打开同一project并确认同HEAD。原CI与长期368+1/Node22 49/审计是前轮证据，本轮发生公开适配改动后新增相关验证与CI，不冒用旧结果。

将本地CM-LONG-20261003-001 / BTC、ETH / USD PriceUSD / 1d / [2021-10-01,2026-10-03) 的3656个真实参考价，接入既有GET /api/reference-history和既有历史UI。保存精确小数、完整身份、首次/版本取得时间、raw hash和原SQLite dataset version。每日参考价依旧不支持分钟State/Research、不是PIT。旧九月发布包不可变、旧v1解码保留。

## 最小接口与数据方案

- 从已有归档只读导出14个批准公开响应及必要的批次/版本元数据，不上传SQLite、完整快照、请求账本、私有偏好、访问凭据。新publication-v2明确≤512KiB、14/16/18个有序已完成批次响应（仅既定14初始+可选完整修订对），原v1仍32KiB。
- 仅抽离现有schema2冻结plan/batches常量为纯module，SQLite和Worker共用，不能把node:sqlite带入Worker。不改预算、源、计算规则。解析复用现有parseCoinMetricsDailyPage，按原顺序重建逐日版本；same-value不更新事实时间，A→B→A保留。读取版本按原plan+response链验证，校验失败拒绝。
- 同一API返回目录和≤31日分页，固定版本/半开范围；不新增数据库、provider请求、后台任务或浏览器全库下载。旧version返回409，非法参数400，失效包503局部降级；访问门禁保持。
- 发布包生成后逐个资产118页与真实SQLite比较完整查询对象；数据包是批准公开字段，raw仅PriceUSD日期/asset，不含账户信息。保留v30包供回退和v1兼容测试。
- UI更新发布覆盖文案、批准batch识别；复用上一轮已验证的跨年分页及默认折叠来源解释，操作反馈、手动周期保持。不重做界面。

## Allowed paths

继承并提交前轮已审coverage29全部产品/测试/报告成果；本轮增改collector/coinmetrics-series-plan.mjs、series.mjs的常量导入；lib/history/published-reference.ts；scripts/publish-reference.mjs；app/api/reference-history/route.ts；components/radar/published-reference-history.tsx；data/published/coinmetrics-long20261003.json；tests/reference-publication.test.mjs及新长期发布回归、tests/browser/radar.mjs必要flag；相关README/CHANGELOG/data文档/API_CONTRACTS/CURRENT_STATE/VERSIONS/主台账/ACTIVE/本卡；忽略outputs/publish-long29。不改旧数据包、不触及秘密、生产配置和金融算法。

## 验证/交付

先发布包校验/缺损/身份/未来时间/修订和固定版本页、旧包兼容；真实全量SQLite对照；再build/typecheck/fullNode/受影响lint、同源生产等效构建五视口、三档动效、失败/取消/跨年闰日/返图表。不把模拟认证当生产登录后验收。独立GPT针对稳定完整diff和数据校验审计，finding修复后VERIFY。

沿用正常GitHub独立分支→PR→Ubuntu Node22 CI→正常合并，禁止强推/绕保护；合并源码tree核对后Sites官方保存/部署到succeeded。当前无生产授权登录会话，不读取既有私有浏览器/凭据；线上以平台状态/必要只读运行日志核对，登录后完整路径未测如实记录。来源免费固定快照，不新增定时任务。用户不需要再批准同一发布。

优化仅在实测瓶颈时；本片没有必须新增的DS任务，不为形式重复调用。已有前轮DS一次受限盘点按旧记录保留；本轮核心适配/发布GPT负责，最终独立GPT审计。

## 本轮实施与新测（发布前）

- public v2构建输入360699bytes、14来源响应、BTC/ETH各1828值；数据版本`4f85a328fb895c82e6db5841b64f28bc7f5492b67fb07df95af3de1210c687eb`。导出118页逐对象等价，独立审计再次比对一致。原v1资料无改动。
- Node24完整374项：373PASS / 0FAIL / 1既有Windows symlink权限skip；Node22.15专项21/21，build/typecheck/受影响eslint PASS。分项执行，未声称Windows执行npm test包装成功。第一次构建缓存EPERM获准缓存访问后重跑；类型检查发现控制流收窄及JS Object.freeze泛型推断已修，最终通过。A→B→A测试预期曾误把新3日响应digest等同旧年响应，已纠正测试预期，产品保留真实响应身份。
- 本地生产等效workerd + Edge149.0.4022.98，五视口1440×1000/768×1024/390×844/320×740/844×390，15组PASS，三档动效、跨年/闰日、返回保留手动周期、401/405/503/409、取消及旧响应隔离。真实日频输入，实时行情/认证为隔离fixture，非生产登录结果、非真机。截图已实际查看桌面与320窄屏价格，完整截图保存在本地输出。
- 本地暖查询5次3/2/3/2/3ms，单页10433bytes；没有对比FPS或生产延迟结论，不进入Optimizer。pageerror为空，3条console error为主动405/503/409用例，未隐藏。五年资料不整体送浏览器。
- 本轮0新增行情HTTP、0新增订阅费用；14请求/314495来源字节属于上一轮已完成实际采集，本轮只从原库导出。公开数据文件不等于异地数据库保管。
- 证据：outputs/publish-long29/{export.json,node-full.log,node22.log,build.log,typecheck.log,lint.log,browser/verification.json及截图}；Git不包含原库和原始日志。原长库恢复/增量及组合负载证据沿用docs/HISTORY_COVERAGE_EXPANSION.md，清楚区分前轮/本轮。
- CI / GitHub合并 / Sites原生发布：待执行后填实值。生产登录后及iPhone真机本轮NOT RUN。分钟许可/分钟Replay/Research、异地保管仍未完成。
