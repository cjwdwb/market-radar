# Asset Intelligence — Context / selected State

2.6 本地候选将选中资产状态升级为 Short90m / Medium180m、Short Relative、Alignment 与历史前后窗口比较。当前方法与降级契约见 [STATE_INTELLIGENCE.md](STATE_INTELLIGENCE.md)。以下 2.4/2.5 内容保留各阶段语义；现有生产为2.5/Sites v23，2.6本轮未部署。

2.4 已于 2026-09-18 发布为 Sites v21；发布证据见 tasks/archive/MR-PUBLISH-ASSET-INTELLIGENCE.md。2.4 不生成 Market State 或交易判断。

## Boundary

共享 Market Snapshot → Engine / raw session → Signal Intelligence → `buildAssetIntelligenceContext`（`lib/radar/workflow.ts`）→ Classic 与 Radar。

Context 是纯函数派生值，不联网、不建 timer、不重算检测、基准收益、Confidence、cluster 或 ranking。父组件对 selected symbol 一次 useMemo，依赖当前 events、coverage、symbol、既有时钟、扫描/网络状态、自选和提醒计数；同一个对象传入两个体验。无事件对象副本或长期 shadow store，导航仍只保存 symbol/eventId。

## Contract

| 字段 | 来源与语义 |
| --- | --- |
| symbol | 当前资产的完整标识，不合并 USDT/USD 或跨市场代码 |
| coverage | Engine coverage 原行引用、结构化状态与原原因；基础/相对能力分开 |
| freshness | 现有 gate、运行可用性与 Engine expiresAt 的保守聚合 |
| activeEvents / primaryEvent / eventCount | 当前资产有效事件，保持 Intelligence 原顺序与对象引用；首项为 primary |
| latestEvidenceAt | 有效事件 raw signal 的最大 evidenceAt，明确为 K 线结束，不是最新报价或检测时间 |
| relationship | 仅现有 event.direction 的可解释关系，附原事件引用 |
| relativeSignals | 有 benchmark evidence 的有效 relative signals 原引用，不重新计算 |
| user | isWatched、enabledAlertCount，独立用户跟踪状态，不参与金融事实判断 |

现有 ranking 仍可按自选影响跨资产显示优先级；本层绝不再排序。Primary 的 Confidence/severity 使用原事件数据，不生成资产评分。

## Coverage and freshness

Engine 为已有 prepare 的失败原因增加 readiness 元数据，判断条件和阈值未改变。分类由 Engine 持有，UI 和 Context 不解析中文文案。

| 输入状态 | coverage | freshness |
| --- | --- | --- |
| 基础与相对检测均可用 | healthy | current；没有 active event 也可 current |
| 基础可用、相对基准不可用或未配置 | partial | degraded；保留其他事件 |
| 缺 coverage 行、报价或历史未就绪 | waiting | insufficient |
| 当前历史周期不支持 | unsupported | insufficient |
| 休市、失效数据、基线样本不足或其他失败 | insufficient | insufficient |
| 报价/历史过期或最近完整 K 线缺失 | stale | stale |
| 扫描停止或离线 | 保留数据覆盖描述 | unavailable，当前事件为空 |

未分类的旧 coverage 失败行回退 insufficient。未知 symbol 不被猜测为支持或不支持，仅呈现真实 Engine gate；helper benchmark 不因聚合而进入用户集合。

active event 还须含同 symbol、active、evidenceAt 不在未来且 expiresAt 尚未到期的信号。这防止旧 reducer 输出在一次 render/effect 之间被当作当前事实；不新增 90 秒等时效阈值。相对能力失效时，依赖相对信号的整个 cluster 暂不参与当前资产 Context，不拆 cluster 或改 raw history。

healthy coverage 下若仍有名义 active 但已无效的候选，freshness 保守为 stale；原 store 更新后可恢复 current。current 表示当前检测输入和事件生命周期允许使用，不承诺事件 evidence 来自最新一笔报价。部分覆盖不可称完全无数据；没有事件不可称市场平静。

## Relationship

- 两个及以上 directional events 同向：aligned（事件方向一致）。
- 同时存在 up/down：mixed（事件方向存在分歧）。
- 只有 neutral events：neutral。
- 无事件或仅一个 directional event：insufficient。

组合事件算一个 event，不将其中 raw signals 再数为多个独立 event。neutral 不提供方向支持。这些描述不是 bullish/bearish、预测或建议。用户自选和价格提醒不参与关系、coverage、freshness 计算。

## Presentation and workflow

Classic 原 Radar awareness 消费共享 Context；仍以图表为中心，必要时附一行可用性提示。Radar 的资产区显示同一摘要，详情默认折叠，展示覆盖、时效、主事件/Confidence、事件关系依据、相对证据与用户提醒数。无新动画；原生 details 键盘操作与现有 reduced-motion 保持。

Radar 同资产 feed 的 current events 使用 Context 引用，历史仍由现有 Intelligence 输出保留。退出资产筛选、返回图表、手动 timeframe、From Radar identity 路径沿用 2.3。

## Cost and validation

新增 provider symbols / quote / history / benchmark / API / timer / dependency 均为 0。只派生 selected asset，输入最多现有 120 条 raw history 对应事件，无全市场 Context map。主包和本机计算测量及最终测试/审计结果写入 `tasks/archive/MR-ASSET-INTELLIGENCE.md`，不能据此推断设备 FPS。

上述为 2.4 契约与历史验证；2.5 的本地扩展见下。评分、confidence 分布、全资产聚合视图、持久历史和 AI 继续 Deferred。

## 2.5 selected-asset State（已发布基线）

`lib/radar/market-input.ts` 机械共享原 Engine 的有效性准备、simple returns 与 RMS；Engine 薄适配保留原原因文案、顺序、Signal/coverage/lifecycle。`lib/radar/asset-state.ts` 是纯派生层，显式接收 selected snapshot、symbol、now、enabled/online；不读事件、自选、提醒、图表 range 或内部实时钟。父组件只派生当前资产一次，Classic 轻摘要和 Radar 默认折叠详情消费同一结果；不建立全资产 map 或持久状态。

规则版本 `asset-state-v1`；维度分别有 `direction-v1` / `rms-v1`。available 分支必须有 classification/metrics、reason=null；失败分支 classification=null，有枚举 reason 与说明。基线为零可以保留有限 RMS 值，但 ratio=null。不生成总评分、资产 Confidence、趋势预测或风险标签。

| 维度 | 固定输入和方法 | 分类 / 限制 |
| --- | --- | --- |
| 方向结构 | 末21个收盘价 / 20段；净变化%=100×(P20/P0−1)，路径效率=绝对净变化/逐段绝对路径 | 绝对净变化≥crypto 0.60%、其他0.30%，且效率≥0.60：窗口偏上/偏下；否则无明显单向结构。平价效率0，不称震荡。 |
| RMS 波动对比 | 简单收益率%；当前末4段与此前不重叠16段分别 sqrt(mean(r²)) | 基线>0.000001%才比较：当前/基线≥1.5较高、≤2/3较低、其间接近。零/近零基线不可判断；不是标准差/年化，较低不代表低风险。 |
| 连续相对表现 | 首版未接入 | Deferred。现有 relative Event 继续独立展示；不同输入门槛/对齐窗口须后续规划，不把旧事件证据当连续基准。 |

门槛为可解释的描述规则，未经预测准确率校准。有限数值检查优先于零基线判断；单维度数值失败不使另一有效维度失效。运算按 JavaScript number 的完整精度，展示舍入不改变判定。

观测数据为已有 Radar 基线：USDT 实际15m（20段300分钟；RMS当前60/参考240分钟），Yahoo 实际5m（100分钟；20/80分钟）。图表15m/1d/1w/1m/3m不是本层窗口控制。prepare 保留至少22根最新连续完整K线、最多80根后缀；乱序/重复/缺口截到最新连续段，不插值跨时段。有效后缀之前的旧点不参与。

State 保留原报价/来源/币种/session/freshness gate：获取年龄≤2分钟、报价年龄≤3分钟；非crypto需open且延迟≤2分钟。额外要求接受的历史time>0、所有barEnd≤显式now、now−latestEnd≤实际interval+60秒。quoteAt−latestEnd也须通过原约束。没有新报价时沿用父组件10秒时钟、可见性/报价事件复核；非毫秒级失效保证，不使用45分钟Signal生命周期。离线/暂停清空当前分类；恢复后重算。

输出分别保留收盘跨度起止、首根开盘、完整K线截止、样本数、interval、source/currency、quoteAt、quoteFetchedAt、historyFetchedAt、calculatedAt。事件 `latestEvidenceAt` 不用于 State freshness，新报价不能刷新旧历史证据。

零新增 symbols / Quote / History / benchmark / API / timer / dependency。当时本地验证、同机 bundle/计算测量、QA-A缺口授权与独立审计见 `tasks/archive/MR-MARKET-STATE-25.md`；其后精修与发布见 `tasks/archive/MR-STATE25-REFINE.md`、`tasks/archive/MR-PUBLISH-STATE25.md`。发布记录不代表生产登录后或真机完整验收。

### 本地精修（MR-STATE25-REFINE）

方向/RMS规则不变。资产详情第一层保留主事件、状态分类、净变化/路径效率、当前与参考RMS、不可判断原因、风险说明与事件覆盖；完整方法/阈值/样本/时间/来源移入原生“计算方法、窗口与来源”，默认折叠，键盘可展开。外层资产详情仍默认折叠。新标签不是Signal或价格提醒。

SSR尚未hydration时传入等待时钟的State，不误称用户暂停；读取用户关闭监控偏好后仍返回paused。折线图采用当前Recharts的原生responsive能力，刻度复用price精度并为长标签使用科学计数，轴宽按实际标签适配；K线交互和行情刷新均未改。验证结果见 `tasks/archive/MR-STATE25-REFINE.md`；旧生产QA缺口按用户最新决定本轮不跟进、不阻塞，不代表补测通过。
