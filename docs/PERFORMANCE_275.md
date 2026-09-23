# Market Radar 2.75 — 本地性能与可靠性证据

日期：2026-09-23。任务：`tasks/MR-PERFORMANCE-275.md`。状态：本轮有界本地测量、确认问题修复和回归已完成；通过冻结的实验室非回归预算，没有证据宣称帧率提速或完整跨设备性能验收完成。最终文档独立复核记录见下文。

## 对象与边界

- 开发基线：`f037f2b24b499fbebd837dead465f92bde750800`，开始时工作区干净；分支 `codex/mr-performance-275`。
- 现有生产：2.7 Foundation / Sites v25，源码 `5d759a19946310deb1afefc12db5a490f4b12af0`；两者只有发布文档差异。本轮不重新发布、不上传。
- 本地真实 production build + Miniflare/workerd，合成认证、无云绑定、拒绝外连；浏览器全部行情使用隔离 fixture，未读取生产凭据或真实用户数据。
- Windows 10.0.26200，Node24.19.0，Edge149.0.4022.98 headless，Core Ultra9 275HX/24logical CPU/31.38GiB。没有CPU节流选项；主机其他负载/电源模式未控制。路由拦截禁用HTTP cache，每轮新context。
- 标准动效、真实推进的Date及产品timer。桌面1440×1000、手机390×844各五轮；手机为桌面视口模拟。设备刷新率/实际呈现帧、React commit profiler、现场INP均未测，不能推断120fps。

## 复现与测量身份

所有原始记录、截图、trace及构建在忽略目录 `outputs/perf275/`，不进入Git。脚本在 `tests/performance/`。

1. `node node_modules/vinext/dist/cli.js build`，复制dist到独立baseline/candidate-build。
2. `node --experimental-strip-types tests/performance/server.mjs outputs/perf275/<build>-build <port>`：loopback、本地Worker、20分钟兜底退出，结束后关闭所持进程。
3. 设置 `PLAYWRIGHT_MODULE` 为本机已安装模块，`RADAR_PERF_URL` 为对应loopback地址。
4. `node --experimental-strip-types tests/performance/run.mjs <label>`：桌面/手机各5轮、每轮至少33秒；最后额外1轮无probe仅作探索，不能证明探针开销。
5. `node --experimental-strip-types tests/performance/soak.mjs <label>`：120秒目标，10秒检查点，前30秒CDP trace，64MiB trace上限。异常/timeout不能PASS。
6. `node --experimental-strip-types --import ./tests/register-types.mjs tests/performance/state-cost.mjs <label>`：独立CPU诊断，1/default8/20+selected各5批×200调用。
7. `node tests/performance/compare.mjs freeze` 只允许首次冻结；随后 `node tests/performance/compare.mjs` 检查候选。

有效label为 `baseline-valid` / `candidate-valid`。`smoke` 本地asset-router配置失败；`smoke2`与中断的`baseline`虽复现导入丢失，但fixture误删最新完成bar、失败检查额外等1s，**排除性能比较**。独立测量复核发现后改为保留最新bar并断言状态available、同步读DOM，再重跑全部有效基线。没有隐藏失败或挑最好一轮。

`run.mjs`不冻结时钟、不拉长动画。`tests/browser/radar.mjs`仍是冻结时钟的正确性工具，部分动效用例刻意延长动画便于验证取消；绝不把这些结果用于FPS/耗时。`import-check.mjs`故意延迟/拒绝File.text，也只作正确性验证。

## 已确认问题及范围

R275-01，MEDIUM可靠性：有效归档→第二页→导入不合法文件，旧版立即清空已接受数据及查询。十次正式基线全部复现。最小修复仅改`components/radar/macro-timeline.tsx`：验证成功且仍是最新操作后才提交view/date/page；失败保留旧归档及查询，并明确提示。

没有修改刷新、金融规则、行情来源、State、图表、动效策略、schema、解析安全或生产认证。没有新增缓存、依赖、常驻timer或请求。现有图表已有memo geometry/series、rAF合并hover/pan、缓存bounds；状态CPU测试不足以支持继续加缓存。

## 预算与结果

预算冻结时间 `2026-09-23T10:54:07.755Z`，早于产品改动。`budgets.json`保存全部五轮数字及write-once预算。

| 指标 | 基线桌面 | 基线手机 | 冻结候选预算（桌面/手机） |
|---|---:|---:|---:|
| 每轮rAF间隔P95的中位数 |16.8ms|16.8ms|≤20/20ms|
| 每轮rAF间隔P99的中位数 |17.0ms|16.9ms|≤21/21ms|
| 每轮longtask总时长，中位数（范围） |288ms（226–407）|337ms（288–350）|≤559/488ms|
| 交互片段ScriptDuration增量中位数 |520.92ms|486.92ms|≤736/668ms|
| 1MiB/200条文件操作完成，中位数（最大） |158.30ms（168.97）|161.81ms（163.74）|最大≤304/296ms|
| 每轮API次数 |28|28|精确保持原provider/symbol/range分组，不允许少刷新|
| 拒绝新文件后保留旧数据 |0/5|0/5|5/5、5/5|

rAF是调度代理；操作完成时间包括Playwright/等待，不是input-to-visible/INP。长任务与script预算按基线最大值加明确余量，不是速度提升目标。范围内差别不宣称提升。

候选同条件五轮已完成，原始所有轮次保留，没有挑最好结果：

| 指标 | 候选桌面 | 候选手机 | 解读 |
|---|---:|---:|---|
| rAF间隔P95中位数 |16.8ms|16.8ms|与基线相同，不能转述为真实60fps|
| rAF间隔P99中位数 |16.9ms|16.9ms|处于基线波动范围|
| longtask总时长中位数 |360ms|334ms|桌面增加、手机略降，均在基线单轮范围及预算内，不宣称改善|
| ScriptDuration增量中位数 |520.88ms|488.32ms|与基线接近|
| LayoutDuration增量中位数 |70.51ms|67.90ms|基线71.15/68.57ms；差异不足以声称提速|
| 1MiB/200条操作完成，中位数（最大） |158.99ms（169.02）|162.33ms（165.14）|未以隐藏内容/降低更新换速度|
| 拒绝新文件后保留旧归档及查询 |5/5|5/5|基线0/5、0/5，可靠性缺陷已修复|
| 每轮API次数 |28|28|逐provider/symbol/range计数完全一致，增减均会失败|

主client chunk：772,408→772,454 bytes（+46 bytes）；500KB历史告警仍存在，本轮没有明显bundle增长或新增依赖。此数据不包含source map；不是gzip传输尺寸。

S4纯CPU：default8的P95范围0.164–0.261ms；20+selected为0.451–0.512ms。该主机纯函数诊断预算3ms，不代表手机整页render。没有跨设备性能承诺。

候选同一纯CPU脚本：default8为0.142–0.255ms，20+selected为0.440–0.576ms；算法零改动，这些差异作为测量波动保留，不包装为优化。

## 六场景覆盖及限制

| 场景 | 实际证据 | 限制 |
|---|---|---|
| S1 开场/滚动/动效 |标准动效真实时间综合基准；既有正确性矩阵已复测|不是触屏真机/真实屏幕呈现帧|
| S2 图表/返回 |综合基准；另有1440/390可见结果断言：pan/start、zoom/count、Home/End、原生wheel滚动、resize不溢出|动作耗时不等于可见反馈延迟；没有真机双指证据|
| S3 刷新并行交互 |33秒综合片段；120秒固定range循环导航/键盘/故障恢复；额外原生15s历史轮询修订后close可见更新|综合片段仅初始+1stockpoll；两次scheduled poll由两侧soak前40秒验证。自然网格新完成bar未逐次独立标注/重复比较，不能把补入旧bar或revision冒称该项已全面通过|
| S4 自选负载 |1/default8/20+selected CPU五批；浏览器20+selected双视口五轮|小/default规模的整页五轮对照未做；CPU与浏览器区别记录|
| S5 导入/查询 |小文件、200条/1MiB合法JSON（含空白padding）、拒绝文件；独立race/cancel/read-failure|不是1MiB真实新闻内容，也不是SQLite/云端查询性能|
| S6 连续运行 |baseline122.144秒/candidate122.137秒，各13检查点；30秒trace9,017,928/9,154,422bytes|非小时级压力；headless换tab实际仍visible，后台隐藏/恢复未验证|

baseline soak：heap10.86–25.49MB，有自然回落；DOM4180–4599，listener865–1978，受展开/失败/GC影响，不证明零泄漏。最终恢复available。Trace单项最大FunctionCall12.04ms、Layout22.4ms、Paint2.12ms；嵌套时间不能直接相加，也不能用它推导dropped frames。503为注入故障、401为合成owner拒绝，和pageerror分别记录。

candidate soak：heap10.26–19.88MB，DOM4135–4616；最终heap11.76MB、DOM4452、listener866、available。两侧均无强制GC，不能拿一次峰值下降声称内存优化。candidate trace单项最大FunctionCall13.17ms、Layout24.38ms、Paint2.20ms，未显示可重复的新长任务热点。

## 验证与审计进度

本轮实际执行与结果：

| 命令/入口 | 结果/证据 |
|---|---|
|`node node_modules/vinext/dist/cli.js build`|baseline/candidate各一次PASS；已知500KBchunk警告保留|
|`node scripts/typecheck.mjs`|PASS|
|`node --experimental-strip-types --import ./tests/register-types.mjs --test tests/fed-history.test.mjs`|16/16 PASS|
|`node --experimental-strip-types --import ./tests/register-types.mjs --test tests/*.test.mjs`|269/269 PASS，包含前述专项，不相加成285|
|`node node_modules/eslint/bin/eslint.js components/radar/macro-timeline.tsx tests/browser/radar.mjs tests/performance/*.mjs`|受影响文件PASS；未重跑全仓既有lint问题|
|`tests/browser/radar.mjs`，`RADAR_FED27_ONLY=1`|8项PASS，五视口+三偏好；`correctness-fed/verification.json`|
|同脚本，`RADAR_MOTION=1 RADAR_INTEGRATION=1 RADAR_STATE26=1`|58项PASS，五视口；`correctness-workflow/verification.json`|
|同脚本，`RADAR_WATCHLIST27_ONLY=1`|14项PASS；`correctness-watchlist/verification.json`|
|`node --experimental-strip-types tests/performance/import-check.mjs candidate-valid`|6项PASS，异步覆盖/读取失败等，不作性能证据|
|`node --experimental-strip-types tests/performance/chart-check.mjs`|最终3项PASS，`RADAR_CHART_OUTPUT_DIR=outputs/perf275/correctness-chart-verified`；两尺寸手势/滚动/resize；15s原生轮询第4次history后，同一显示UTC时间09/23 11:00的close由102.78→102.81。该fixture原生15m，与显示分钟精度对应|
|`node tests/performance/compare.mjs`|26/26预算/请求gate PASS|

浏览器均设置本机`PLAYWRIGHT_MODULE`、loopback `RADAR_PREVIEW_URL`/`RADAR_PERF_URL`，既有harness另显式`RADAR_SYNTHETIC_AUTH=1`，因此不读取`.dev.vars`。没有把`npm test`包装命令写成已运行：Windows使用实际分项入口，避免再次build。合计89项浏览器**检查记录**（8+58+14+6+3），不是89轮性能采样。

pageerror均为空。主性能/归档/自选检查console无警告；完整工作流记录25条资源错误：14次401（合成monitor拒绝）、7次ERR_FAILED（脚本故意abort/离线用例）、4次503（error fixture）。两侧soak各8条受控401/503；不把errors=[]说成console完全干净。动效正确性用例中的fixtureCLS不作为性能结论。

独立GPT测量复核纠正两项harness问题并重跑baseline。独立GPT产品审计未发现产品BLOCKER/HIGH/MEDIUM；指出1项MEDIUM综合片段股票poll覆盖不足（明确较窄结论、改由soak独立验证）和1项LOW请求只能增不能减的gate缺陷（改为精确分组相同），随后基于原始JSON VERIFY关闭两项。最终文档及新增图表检查的只读复核另记，不能冒称审计Agent亲自重跑全部浏览器。DS实际调用0，没有第三方外发。

最终复核另发现1项LOW证据措辞：第一份图表报告只有close变化，未记录bar身份，不能称same-bar。已保留原记录，增加前后显示时间及`sameBarStatus`，重跑到独立`correctness-chart-verified/`，结果同一09/23 11:00、102.78→102.81、PASS；跨真实网格时脚本会明确同bar未测，不误认。最终89项采用此新3项，不把旧3项重复计数。产品hash未变，受影响脚本lint复测PASS。

最终独立GPT Auditor已读回新代码和报告，确认该LOW针对本次运行关闭；本轮3项审计finding（1MEDIUM、2LOW）均修复/补证并VERIFY，无剩余confirmed finding。审计是独立只读源码与证据复核，浏览器由协调者实际执行。临时5290/5291预览已关闭，无后台测量继续运行。

## 交付、限制与下一步

- 产品只改`components/radar/macro-timeline.tsx`；验证改`tests/browser/radar.mjs`并新增`tests/performance/`。任务索引/报告同步更新。
- 同一归档viewId、同一页2、同一无效导入、同一viewport的前后截图：`outputs/perf275/matched/before-1440.png`、`after-1440.png`、`before-390.png`、`after-390.png`；数据保留改变内容高度及可滚范围，未裁掉重要说明。代理已实际查看390前后截图。
- 真机/高刷新屏、实际presented/dropped frames、真实后台恢复、小时级soak、React commit profiling、小/default自选浏览器五轮对照、SQLite查询/恢复性能均未覆盖或工具不支持。生产未作本轮登录后验证。不是全部2.75场景PASS。
- 结论分开：**本地性能调查已完成；确认可靠性问题已修复；冻结实验室预算通过；完整性能优化验收证据仍有限。** 没有减少刷新/动效/证据，也没有可声称的帧率提升。任务保留可追踪限制，不用零新热点伪造优化成果。

完整2.7的owner清单、许可价格历史、回补覆盖、长期保管、研究流程待办保留。本轮未采集、未迁移、未push/tag/deploy，现有2.7 Foundation已上线的事实不变。

后续发布（独立授权）：2.75已上传并部署为Sites v26，源码`0a86366`。本报告的未提交/未发布描述属于开发阶段；测试范围与限制未因此改变。记录tasks/archive/MR-PUBLISH-PERFORMANCE275.md。
