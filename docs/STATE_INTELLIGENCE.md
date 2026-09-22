# Selected Asset State — 2.6

纯函数 `buildAssetStateV2` 描述当前选中资产的历史价格结构，不产生 Signal、提醒、综合评分或预测。Classic 与 Radar 使用父组件派生的一份结果。图表 range/pan/zoom、事件列表及用户 Watch/Alert 不参与分类；`now` 和运行状态显式传入。

## 规则与窗口

`asset-state-v2` 使用 `elapsed-v1`，配置 `short90-v1` / `medium180-v1`。Direction/RMS 数学方法仍为 `direction-v1` / `rms-v1`，但窗口与门槛为下面明确的新配置，不宣称与 v1 分类相同。旧 `buildAssetState` 的 20/4/16 与完整输出保留。

设最新有效完整收盘为 T、H 为 90/180 分钟、实际 interval 为 5/15 分钟。Direction 使用 (T−H,T]；RMS 当前观测 C=H/3、此前参考 B=2H/3，收益段不重叠。RMS 是简单收益率百分数的均方根，不是标准差或年化值；低波动不等于低风险。

| 实际 interval | 窗口 | 当前所需收盘点 | RMS 当前/参考收益段 | Direction 前后比较所需点 | RMS 前后比较所需点 |
| --- | --- | --- | --- | --- | --- |
| 5m | Short 90m | 19 | 6/12 | 37 | 25 |
| 5m | Medium 180m | 37 | 12/24 | 73 | 49 |
| 15m | Short 90m | 7 | 2/4 | 13 | 9 |
| 15m | Medium 180m | 13 | 4/8 | 25 | 17 |

所有维度仍先满足原 preparation 的至少 22 根、最多 80 根最新连续后缀。表中点数只是数学窗口需求，不是放宽 gate。15m 短窗 RMS 仅两段收益，不能解释为统计置信度。

方向：净变化 `100×(end/start−1)`，路径效率为绝对净位移/逐段绝对位移和。效率 ≥0.60 且绝对净变化达到门槛才为窗口偏上/偏下，否则为无明显单向结构，不称震荡。Short 门槛 crypto 0.30%、其他 0.15%；Medium 为 0.60%/0.30%。它们是描述性门槛，未校准预测准确率。

RMS：有限数值校验优先；参考须 >0.000001%，比值 ≥1.5 为较高、≤2/3 为较低，其间接近。零/近零参考返回不可判断，ratio=null；不填任意数。

## Short Relative

`relative-window-v1` 只支持 Short90m。复用原 `benchmarkFor` 显式映射及已加载数据，不为未知资产猜基准、不自比、不增加请求。双方分别准备并检查 source/currency/market/session/interval、报价时间同步；双方最新有效收盘必须完全相等（允许落后 0 根）。窗口每个点精确配对，不按下标或 nearest 拼接。

`delta = assetReturnPercent − benchmarkReturnPercent`，单位 **百分点**，不是 alpha 或财富比。crypto ≥0.30pp 跑赢、≤−0.30pp 跑输；其他 ±0.15pp；严格中间为接近。无基准为 unsupported，缺输入 waiting，不足 insufficient，过期 stale，不同元数据/时间网格 invalid；整数根尾点落后 insufficient。基准失败不清空 Direction/RMS。

输出包含两侧 symbol/source/currency/session、quoteAt/quoteFetchedAt/historyFetchedAt/latestEndAt，配对范围、interval、点数、方法配置和门槛。无有效事件也能计算；旧 relative Event 不为失效数据续命。

## Alignment

`state-alignment-v1` 比较 Short Direction、Medium Direction、Short Relative；只比较有效且尾点相同的参与项。RMS 只提供背景，不参与方向投票。

| 已计算关系 | 输出 |
| --- | --- |
| up/up/stronger 或 down/down/underperforming，三项完整 | aligned |
| 两方向不同（含一个 no_direction），或 Short up/relative underperforming、Short down/relative stronger | mixed；即使其他项缺失也保留已知差异 |
| 无已知差异，但有缺失/不相容项 | insufficient |
| 完整、无已知差异，且含 no_direction 或 relative similar | neutral |

保留 required/evaluated/missing、每项窗口和缺失原因。不表示买卖倾向；两个窗口共享数据，不是独立确认，Short Relative 也不代表确认 Medium 全段。

## Historical Transition

`historical-adjacent-v1` 在真实 now 准备一次，再用已验证历史重算前一窗口；不读上次 render、会话快照或 Event。只有 changed/unchanged/unavailable，不输出 strengthening、精确 shiftAt 或反转预测。

Direction/Short Relative 步长 H，当前 (T−H,T]、前窗 (T−2H,T−H]；共享一个边界收盘，无共享收益。RMS 步长 C；当前观测 (T−C,T]、前观测 (T−2C,T−C]；本次参考 (T−H,T−C]、前参考 (T−H−C,T−2C]。两次参考共享 C，且本次参考包含前次观测；类别变化可来自观测和滚动参考，不能称独立样本确认。

本窗有效而前窗不足/数值失效，只令该比较不可用。Alignment 缺失不阻断比较。前窗计算不读取其端点之后的价格。返回 from/to 方法、规则、配置、指标、完整依赖/观测/参考窗口、步长及重叠说明。历史修订可改变结果；这不是当时在线观测记录。

## 有效性与能力边界

沿用共享 preparation 的来源、币种、session、报价/获取时效及连续后缀；State 再要求 time>0、barEnd≤now、完整证据年龄≤interval+60秒。乱序、重复、午休/隔夜缺口不插值；新报价不能刷新旧历史。离线/暂停、时钟越界立即在既有更新节奏重新派生，不增加 timer。不同维度分别返回枚举 availability/reason，缺失不补中性。

当前 Point 无逐 bar 交易时段元数据，只能核对响应元数据与连续网格，不能声称每根历史 session 已认证。A 股单段最多24根、港股30/36根，无法满足 Medium37点；Short 也须等原22点 gate。US Medium Direction 前后比较需73点；crypto 两窗可用仍以真实完整/新鲜数据为前提。

界面保留紧凑摘要；方法/来源与历史比较均默认折叠。历史比较内5项各自按需展开，不互斥；单项不可用原因保持可见。关系缺失说明标注对应维度；详情底部可复用原导航返回当前图表，保留手动周期。完整范围/数字证据均保留，所有金融标签来自领域结果，UI只格式化。局部体验精修证据见tasks/archive/MR-STATE26-REFINE.md。

新增 provider symbols、Quote/History/benchmark/API、timer、依赖均为0。共享 `prepareStateInput` 和参数化数学；原 detector 的 Map+flatMap 仅提取为 `pairPreparedInputs`，不改变原 readiness/Signal 规则。81份固定2.5全对象 oracle 专门验证原 State/Engine/coverage/intelligence 等价。

Deferred：Medium Relative、更多 Horizon、全资产状态、新映射/数据请求、逐 bar session 日历、持久历史、AI/预测/评分。实施与实际验收见 `tasks/archive/MR-STATE-INTELLIGENCE-26.md`。现有生产2.5/Sites v23；2.6本轮未部署。
