# Changelog

本文件记录 Market Radar 的可识别产品里程碑。完整发布来源、验证范围和回退注意事项见 [docs/VERSIONS.md](docs/VERSIONS.md)。

## Radar 2.7 Foundation — 阶段发布 — 2026-09-23

- 自选状态总览与Classic/Radar单资产详情同源；分维度显示可用性和缺失原因，保留手动周期/导航/提醒语义，新增本机名单显式导出。
- 新增本地官方宏观归档查看：文件验证、UTC范围查询、固定版本分页、来源/时间说明；不上传、不触发采集，刷新清除导入。
- 本地NodeSQLite归档基础支持严格来源、硬限额、租约/检查点、版本去重与恢复禁采集；真实美联储2条资料打通入库/查询/恢复/显示。原始数据库与样例不上传GitHub或部署。
- 269Node/最终44专项/build/typecheck/33浏览器与独立审计通过；真实请求4次含2次格式失败，修复后写入2条、重跑0新增。未声称全月完整、PIT、预测能力或真机/生产登录后通过。
- 本版本仅B0/C0/B1/C1阶段成果；真实owner清单、价格历史授权/回补、研究D、长期存储/云调度仍待补。已发布Sites v25，源码`5d759a1`，平台succeeded；产品里程碑`radar-v2.7-foundation`及发布标签`sites-v25`指向同一源码。发布记录见tasks/archive/MR-PUBLISH-FOUNDATION27.md，后续文档提交不重新部署。

## Radar 2.6 — State Intelligence II — 2026-09-22

- 当前资产新增90/180分钟方向结构与RMS窗口；连续Short Relative复用显式基准，严格校验来源/币种/session/周期与完整配对，无基准不补中性。
- 增加可解释的Alignment关系及相邻历史窗口Transition；共享数据不重复投票，RMS不参与方向判断，历史重算不等于实时事件或预测。
- Classic/Radar同源，逐维度失效；保留旧Signal、Confidence、Clustering、Ranking和v1完整输出，81份固定旧版oracle等价。零新增provider symbol/请求/timer/依赖。
- 历史比较逐项展开、失效原因明确标注维度、详情底部返回当前图表并保留手动周期。390px同fixture默认总览2368.5→475.75px，完整数值证据保留。
- 领域实施218 Node通过；最终精修build/typecheck、6专项/10状态/9精度回归与320补证1项通过。独立领域/集成审计完成，精修1 LOW截图证据问题修复并VERIFY。生产与真机范围另行记录，不把历史测试写成本轮重跑。
- 已发布为Sites v24，源码`8641d81`，平台确认succeeded。GitHub产品标签`radar-v2.6`和发布标签`sites-v24`标记同一源码；发布记录见`tasks/archive/MR-PUBLISH-STATE26.md`。后续说明文档提交不代表重新部署。

## Radar 2.5 — Market State Intelligence — 2026-09-22

- 当前选中资产新增确定性的方向结构与RMS波动对比，Classic摘要与Radar详情共享结果；无异常事件也可判断，状态不依赖事件数量、自选或提醒。
- 基于已有完整连续K线，显示观测周期、指标/单位、方法、阈值、来源及证据时间；过期、缺失、暂停或离线时明确降级。没有预测、总评分、AI或新增行情请求/timer。
- 详情保留主事件、净变化/RMS和限制，完整计算依据默认折叠；修复极小价格归零、大额相邻刻度重复、图表尺寸warning和初始加载误标暂停。
- 连续相对表现Deferred；既有Signal/Confidence/Cluster/Ranking、相对事件和行情刷新语义不变。
- 最终99 Node、build/typecheck、五视口9项专项通过；62项综合浏览器在最后刻度LOW修复前通过。独立GPT审计修复并VERIFY，无未解决confirmed findings。证据见MR-MARKET-STATE-25和MR-STATE25-REFINE归档；本轮发布状态以版本索引为准。
- 已发布为Sites v23，源码`31a11d2`，平台确认succeeded；GitHub产品标签`radar-v2.5`和发布标签`sites-v23`标记同一源码。发布记录见`tasks/archive/MR-PUBLISH-STATE25.md`。

## Radar 2.45 — Visual Experience & Motion Control — 2026-09-22

- 统一黑白面板层次、导航/图表控件、自选行和 Radar 事件卡；资产详情主事件前置，手机返回操作位于展开详情之前。
- 增加持久化的跟随系统/标准/减少动效设置，统一首屏、CSS 与 JS 语义；支持实时系统偏好与运行中动画取消。
- 保留品牌、低饱和涨跌、行情/提醒及所有金融算法；新增依赖、行情请求和 timer 均为 0。
- 83/83 Node tests、类型检查、构建及五视口 48 项浏览器检查通过，独立审计未发现可证实的 BLOCKER/HIGH/MEDIUM。主 client chunk 增加 1,406 bytes；仍有既有大包告警，未声称真实设备 FPS 提升。
- 开发验收见 tasks/archive/MR-VISUAL-245.md；本次发布结果以版本索引和独立发布记录为准。
- 已发布为 Sites v22，源码 `6804b41`，平台确认 succeeded；GitHub 的 `radar-v2.45`、`sites-v22` 标记部署源码。

## Radar 2.4 — Asset Intelligence Foundation — 2026-09-18

- Classic 与 Radar 共用确定性的当前资产情报，保留已有排名、Confidence、组合事件及原始信号。
- 增加可追溯的覆盖/可用性、事件方向关系、相对证据和用户跟踪状态；离线、暂停或过期时保守降级，详情默认折叠。
- 包含 PRE24 正确性修复：证据量纲、极小价格精度、缺失自选覆盖计数和当前筛选空状态。
- 开发 Provider 文档单独归档；产品不引入 LLM、依赖、请求或 timer。
- 发布前全量 80/80 tests、typecheck、build、五视口 36 项浏览器检查及独立审计/VERIFY 完成。生产发布结果见版本索引与发布任务归档。
- 已发布为 Sites v21，源码 `c618b41`，平台确认 succeeded；GitHub 产品标签 `radar-v2.4` 与发布标签 `sites-v21` 对应同一源码。

## Radar 2.3 — Classic × Radar Deep Integration — 2026-09-17

- Classic 图表旁提供当前资产 Radar 入口，可查看同资产事件并返回图表，保留用户选择的周期。
- From Radar 上下文引用实时事件，避免事件变化后继续展示旧事实。
- Classic 与 Radar 共享自选及价格提醒状态，事件详情可查看已有提醒。
- 已发布为 Sites v20，源码 `f96a526`；平台确认部署成功。发布前 70 项 Node tests、30 项浏览器检查、构建和类型检查通过；线上登录后完整交互未复测。

## Radar 2.2 — Coverage & Workflow — 2026-09-16

- 为 My Radar 增加完整、部分覆盖和等待数据的概况。
- 事件可直接进入对应资产与合适的图表范围，并在 Classic 保留 From Radar 上下文与返回路径。
- 展开事件后可复用既有自选和价格提醒操作。
- 已发布为 Sites v19，源码 `52ebe5f`；平台构建与部署成功，线上完整浏览器交互未复测。

## Radar 2.1 — Signal Intelligence — 2026-09-16

- 增加同步 benchmark 相对强弱、结构化触发证据和独立 Confidence。
- 同一资产的相关信号聚合为可解释事件，并按自选、严重度、可信度和时效排序。
- 已作为 Sites v18 发布源码；版本回退点为 `radar-v2.1`。

## Sites v17 — 2026-09-15

- 加入 Classic / Radar 双体验和可追溯的市场异动信号。
- 改善 OKX、Yahoo 传输失败恢复、限流等待和相同请求合并。
- 相同 Radar 快照不再触发无效状态替换；接入官方 Cloudflare runtime 类型检查。
- 生产源码：`106c144`；当前正式网址：<https://market-radar-rex.swt-aether.chatgpt.site>。

## Sites v16 — 2026-09-14

- 完成桌面、平板、手机和横屏布局精修。
- 优化黑白层级、控件、图表空间和手机浅色品牌图标。
- 整理公开 GitHub 项目的 README、截图、CI 和安全配置示例。

## Sites v15 — 2026-09-13

- 降低行情动画和图表绘制的主线程开销。
- 加入克制的价格方向提示与多样微交互，保留 reduced-motion 支持。

## Sites v14 — 2026-09-13

- 统一品牌开场、页面过渡和控件动效。
- 加强 K 线拖动、缩放、键盘操作、回到最新与触控手势。
- 修正导航锚点和开场异常退出行为。

## Sites v11–v13 — 2026-09-12 至 2026-09-13

- 逐步加入可缩放/拖动 K 线、页面导航跟踪和品牌动效。
- 这些中间发布保留独立 Git 标签，便于定位和回退。

## Sites v10 — 2026-09-12

- 加密报价与图表历史分离加载，股票和加密行情并行。
- 加入缓存、结构共享、失败退避及格式化和指标计算优化。

## Sites v9 — 2026-09-11

- 在黑白界面中恢复低饱和绿涨红跌提示。

## Sites v8 — 2026-09-11

- 建立黑白极简金融工作台视觉，接入定制品牌标识。
- 保留统一访问码保护、K 线指标和展开详情。

## Earlier history

更早提交建立了行情工作台、15 分钟 K 线、自选、提醒、OKX / Yahoo 数据与云端监控。它们没有足够的已保存发布证据，因此保留 Git 提交历史，不补造 Sites 版本标签。
