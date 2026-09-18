# Asset Intelligence Context — 2.4

本地实现；生产仍 2.3 / Sites v20。2.4 不生成 Market State 或交易判断。

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

Deferred：Market State、评分、confidence 分布、全资产聚合视图、持久历史、AI、2.5/2.8/3.0。NOT DEPLOYED。
