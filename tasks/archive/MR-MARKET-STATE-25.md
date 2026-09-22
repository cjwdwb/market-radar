# MR-MARKET-STATE-25 — Contract and local implementation report

2026-09-22 / Asia/Shanghai。阶段：**经用户批准隔离实现；约定本地范围验证完成；独立最终复核通过**。规则版本 `asset-state-v1`。第1–10节保留规划与契约，第11节为本轮新测；不能将本地结果解释为生产或真机全面验收。

Gate更新：用户明确答复“允许带 QA-A 缺口进行上述隔离实现”。允许下述两维度在独立分支 `codex/mr-market-state-25-builder` 实现、本地测试及独立审计；QA-A仍BLOCKED、整体2.45证据不足，不授权merge/push/tag/deploy或接受其他未知风险。以下初始Gate记录保留决策背景，当前以本段授权为准。

## 1. Baseline / Gate / QA handoff

- 本轮只读核验：GitHub main 与本地 HEAD 均为 `8a79166512d26d958c5ad380b2e3977cb2265d1f`；开始时工作区、暂存、未跟踪为空。当前规划分支 `codex/mr-market-state-25-planner`，未覆盖旧QA成果。
- 实际产品生产：2.45 / Sites v22，源码 `6804b41f5c6763cc631c9919e24e93fd6a076bbc`。本轮Sites API确认原deployment `appgdep_6ab2163711948191b0f2ee7d7b943063` succeeded / env revision 3；此为平台状态，不是登录后路径。
- 起点main与生产产品代码一致；后续文档/测试提交不是生产重新部署。历史QA的48+6浏览器、3项Node以及更早83/83/typecheck/build仍是历史；2.5本轮实际重跑项目另记第11节。
- 未在仓库docs/tasks和本机attachments定向文件名搜索中找到 `market-radar-2.5-kickoff-handoff.md`；本轮以用户完整指令和核实源码为依据，没有编造文件内容。
- 2.45权威QA报告：`tasks/archive/MR-245-POST-RELEASE-QA.md`。初始整体“证据不足”保留，未因上传/归档改为全部通过。

| QA | 原状态 | 负责人/条件 | 本轮对象/操作 | 当前结果/证据 | 下一步 |
| --- | --- | --- | --- | --- | --- |
| QA-A 生产登录后只读路径 | BLOCKED | 用户安全登录；GPT只读检查 | 现有v22，新独立Edge，复用post-release.mjs，无fixture/测试Cookie | BLOCKED。脚本到达门禁LOGIN_REQUIRED；用户说明当前无法使用Edge，已停止此尝试。没有授权工作台/真实报价证据；旧production.json已备份outputs/market-state25/qa-a-prior.json，不把旧文件当新结果 | 有条件时再安全登录，或用户明确批准带此缺口仅隔离开发；不能绕门禁 |
| QA-B iPhone第5步 | NOT RUN | 用户真机反馈 | iPhone16 Pro/iOS26.2、正式2.45，资产→Radar/情报→图表，手动周期再往返 | PASS（用户报告）。在澄清“应该OK”后，用户明确回复“已实测，四项都正常”，覆盖资产正确、周期保留、返回可用、限制清楚；无截图/独立Safari build | 保留为用户实测，不冒称代理实测；不证明未来2.5新增UI真机通过 |

其余真机1/2/3/4/6步继续保留历史用户PASS，不重复全套。QA-A只有环境/会话缺口，无确认产品缺陷。用户“继续，我现在无法使用edge，你自己检查一下然后推进项目吧”支持继续只读规划，不自动解释成已明确接受QA-A缺口进入Builder。

**Gate 决定（已满足）**：QA-B完成、QA-A受阻；用户已明确允许带 QA-A 缺口在独立分支实现下述两维度及本地测试/审计。不得据此把 QA-A 改PASS、接受所有未知风险或合并/上传/发布。若QA-A后续发现重要回归，单独回到2.45范围处理。

## 2. Goal / Non-goals / final proposed scope

Goal：只对当前selected symbol描述明确连续窗口内的方向结构与波动对比；同一纯函数结果供Classic轻摘要和Radar折叠证据使用。没有事件仍可计算，有效性与分类分离。

批准纳入首版的Planner范围（仍受Gate约束）：
1. 机械提取现有prepare、基本收益/RMS能力，保留Engine/coverage输出语义。
2. 两维度纯状态、明确窗口/数值/失效原因；新State对已接受历史追加严格当前时钟完成校验，不改旧Signal策略。
3. 在共同父组件派生selected一次，轻量接入现有资产区域；不复制Context/Signal store。
4. 确定性、原Engine等价性、工作流/动效/五视口测试、独立审计。

Deferred：连续相对表现分类（原有relative events仍按原逻辑展示）、完整趋势/趋势强度、多周期综合、全自选状态map、状态历史、评分/风险等级/预测、AI、后台采集、新源/请求、数据库、2.5生产发布。无校准准确率/FPS承诺。

## 3. Actual ownership / data map

```text
app/market-radar.tsx
  quotes + trends + selected + chart range + now(10s) + mayRun/online
  symbolKey = overview ∪ watchlist ∪ selected ∪ enabled alert symbols
  requestKey = symbolKey ∪ explicit benchmark symbols
    ↓ shared radarSnapshot (quotes, trends histories, symbolKey)
  useRadar: effect→reducer(scanRadar)→raw session store→intelligence
    ├ coverage: synchronous useMemo using snapshot/now
    └ intelligence: memo using store.signals/watchlist/now (effect may be one render behind)
  selectedRadar: buildAssetIntelligenceContext(events/coverage/selected/now/runtime/user)
  [proposed] selectedState: pure prepare/state(snapshot, selected, now, enabled, online)
    ↓ same selectedState object to Classic and Radar existing asset detail
```

`workflow.ts/buildAssetIntelligenceContext`只持有有效事件引用、主事件/原confidence、coverage/freshness、事件方向关系、用户跟踪。latestEvidenceAt是事件时间，不能给连续状态作时效背书。2.5不读取events来判分类，不读取旧coverage来批准新snapshot；原有Context继续负责事件说明。

数据事实：
- `app/market-radar.tsx:167–173,228–243`：USDT扫描历史来自共享trends，`/api/history?range=1d`，15m、OKX96根，刷新目标60s。Quote与历史分开；旧历史fetch失败不更新fetchedAt，最终按失效门限退出。
- `lib/market-data.ts`：非USDT quote自带Yahoo 1d/5m points，常规股票会话限定；兼容旧USD crypto也属此5m路径。不能将其当作15m USDT数据或改币种。
- Engine内部prepare保留最多80根的最新连续已完成后缀，要求至少22根；股票开盘/午休后不足22根会不可判断（5m约110分钟门槛），不跨休市拼接，不新增历史以绕过门槛。
- Chart独立historyCache keyed by selected:range。Yahoo range→interval 为15m→15m，1d→5m，1w→60m，1m/3m→1d；OKX为15m/1d→15m，1w→1H，1m→4H，3m→1Dutc。**State只用Radar的5m/15m基线**，不消费chartPoints，pan/zoom/range/display不进入金融依赖。
- Clock由父组件10秒timer、visibility和报价成功更新，enabled=hydrated&&mayRun，mayRun由auto/visible/backgroundTabs/online决定。State无timer，边界跨越最迟由下一次现有clock事件重新判定，非实时毫秒承诺。

## 4. Capability matrix / benchmark audit

| 维度 | 输入/现有helper | 窗口与最低样本 | 限制 | 最小补充 | 首版 |
| --- | --- | --- | --- | --- | --- |
| 方向结构 | prepare连续close；尚无方向效率指标公共helper | 最近20段close变化/21点；继承prepare至少22点。5m=100分钟，15m=300分钟 | 非完整趋势判别；休市/短时段/缺口不足退出；极小净变化不等于横盘 | 纯净变化%+路径效率，完整时间/单位；无需网络 | 支持，标签用“窗口偏上/偏下/无明显单向结构” |
| 波动对比 | engine私有simple return、rms；已有volatility_spike使用当前4/此前16 | 最近20段收益/21点，继承22点；4与16不重叠 | RMS非标准差/非年化，跨市场实际时长不同；零/近零基线不能除 | 共享原RMS数值方法，单独状态分类与有限值guard，不读取spike事件 | 支持，高于/接近/低于此前基线；不称高低风险 |
| 连续相对表现 | explicit benchmarkFor公开；prepare/relativeReadiness私有；pair builder在detector内部 | 实际15分钟收益：股票3×5m、USDT1×15m；现有参考12–20窗 | readiness与detector策略不完全一致，参考可能重叠，顶层event时间不总等于pairEnd；未配置或自身无基准 | 需独立统一pair事实边界及等价性；不得用旧event替代当前原数据 | Deferred，数据部分具备但不在本轮增加第二组共享提取/金融分类 |

真实benchmark映射仅硬编码名单：ETH/SOL/XRP/DOGE/LINK/ADA/AVAX-USDT→BTC-USDT；NVDA/AAPL/TSLA/MSFT/GOOGL/AMZN/META/COIN→QQQ；600519.SS/300750.SZ→000300.SS；0700.HK/9988.HK/1810.HK→^HSI。BTC、QQQ、SPY及未知symbol无映射，不能自比或按市场自动猜。

文档差异：`docs/INTELLIGENCE.md`仍称“自定义代码按市场映射”，比engine.ts:14–23的实际白名单宽；以代码为准。Builder允许只纠正这句文档，不扩大基准范围。首版状态不消费benchmark，但既有relative事件保持。

## 5. Two-dimension deterministic contract

统一输入：完整symbol、现有RadarSnapshot、显式有限now、enabled/online、固定ruleVersion。不读Date.now/DOM/storage，不改变输入，不接收events/watchlist/alerts用于计算。

### Direction structure（direction-v1）

- 业务问题：指定20段窗口的累计价格变化是否足够且主要沿同一方向，而非一次异常是否发生。
- 从共享Prepared末21个收盘价P0..P20取值。`netPercent=100*(P20/P0-1)`；`path=sum(abs(Pi-Pi-1))`；path>0时`efficiency=abs(P20-P0)/path`，path=0时efficiency=0并明确flat事实。全部中间结果必须有限，不能用Infinity/NaN或填充值。
- 有方向条件：`abs(netPercent) >= floorPercent` **且** `efficiency >= 0.60`。floor沿现有市场分类选择crypto 0.60%、其他0.30%，是首版描述门槛（参考现有价格噪声下限），不是经校准的预测参数，也不改Signal触发线。
- 有方向且net>0→`upward`/“窗口偏上”；net<0→`downward`/“窗口偏下”；否则数据有效→`no_direction`/“无明显单向结构”。这不是“震荡/平静/中性建议”。完全平价同样来自真实价格证据，不因无事件得到。
- 无历史基线比较。展示net%、efficiency（可显示比例而非confidence）、两个阈值、样本数20段、close起点/终点时间及interval。
- 5m输入观测100分钟，15m输入300分钟；没有状态窗口选择器。不得随图表1w等切换。

### Volatility comparison（rms-v1）

- `r[i]=100*(P[i]/P[i-1]-1)`，百分比简单收益；复用现有均方根方法`RMS=sqrt(mean(r[i]²))`。不去均值、不年化，不标成标准差或风险。
- Current C=最近4段RMS，baseline B=紧接此前16段RMS；两组收益不重叠，只共享分界收盘价。最少21点参与，prepare仍需22点。
- 5m：当前20分钟、基线80分钟；15m：当前60分钟、基线240分钟。证据保留每段准确起止，不写笼统“当前波动”。
- 计算优先序固定：先检查全部所需收益、平方、平方和、RMS结果为有限数，失败即invalid_numeric；通过后才判断基线下限；只有基线有效才计算并检查ratio有限性。B=0同时C溢出时必须invalid_numeric，不能被baseline_too_small掩盖。
- 若B<=0.000001%（1e-8相对收益，**数值稳定性下限**），此维度`insufficient`/`baseline_too_small`，分类null，ratio=null。平价B=C=0也不能造“低风险/正常波动”；分别展示有限的C、B和不能比较原因，不展示商、不使用epsilon替代分母。
- 若B>下限且所有计算有限，ratio=C/B。ratio>=1.50→`higher`/“高于此前基线”；ratio<=2/3→`lower`/“低于此前基线”；其余→`similar`/“接近此前基线”。等于边界分别归higher/lower。这些是透明描述区间，非新spike阈值或异常提示；保留原spike的3倍等规则。
- 当前C=0、B有效时可lower；极大/极小价格造成非有限收益/RMS/比值时仅本维度`invalid_numeric`；不能隐藏数字或裁切价格掩盖。

### Relative dimension（明确Deferred）

不增加continuous relative标签或基准请求；保留现有相对Event说明，明确它属于事件。若契约需占位，使用availability=`unsupported`、reason=`dimension_deferred`、classification=null、文案“连续相对状态尚未启用”；不伪装为“基准缺失/表现持平”。不默认渲染第三张卡。后续需重新定稿同步pair窗口/基线/阈值并过Gate，不由Builder临时决定。

### Output contract

`AssetState`（候选位置asset-state.ts）包含symbol、ruleVersion、calculatedAt、direction/volatility结果及实际数据provenance；不持久化。

每个维度使用判别联合：availability=`available|waiting|insufficient|unsupported|stale|invalid|paused|offline`。仅available分支有非null classification；失败分支有枚举reason及domain生成的说明，不靠UI解析中文。可靠性表示“可判断/不可判断+条件”，不生成总confidence分或借用event confidence。

必备证据：methodId、intervalMs、closeStartAt/closeEndAt（供收益跨度）、firstCandleStartAt、evidenceEndAt（末K线结束）、returnCount/pointCount、metrics及单位、基线/阈值、source/currency、quoteAt/quoteFetchedAt/historyFetchedAt、calculatedAt、限制。returns的起点是P0的收盘时间，不把P0开盘到P20收盘的21根跨度误称20段收益窗口。

例如首版reason：awaiting_clock/quote/history、insufficient_contiguous_bars、unsupported_interval、source_currency_mismatch、quote_failed/invalid_quote、stale_quote/history/evidence、session_unavailable、future_evidence、invalid_numeric、baseline_too_small、paused、offline、dimension_deferred。映射与数据校验一起由domain持有；View只格式化数字/时间/单位与展示文本。

失败映射及优先级定稿（不由Builder/UI临时解释）：

| reason | availability | 顺序 |
| --- | --- | --- |
| offline | offline | 运行gate第1 |
| paused | paused | 运行gate第2 |
| awaiting_clock | waiting | 运行gate第3，缺失或非有限now |
| awaiting_quote / awaiting_history | waiting | 共享prepare的原执行顺序 |
| quote_failed（含身份不一致/quote.error）、invalid_quote、source_currency_mismatch、invalid_history | invalid | 共享prepare首个失败；invalid_history包括实际使用后缀的无效价格/时间 |
| stale_quote / stale_history / stale_evidence | stale | 共享prepare首个失败，或其通过后的State证据年龄检查 |
| session_unavailable / insufficient_contiguous_bars | insufficient | 共享prepare首个失败 |
| unsupported_interval | unsupported | 共享prepare首个失败 |
| future_evidence | invalid | prepare通过后：使用段time>0校验之后，证据年龄检查之前 |
| invalid_numeric | invalid | 每个维度指标计算的有限性先检查；不污染其他已可判断维度 |
| baseline_too_small | insufficient | volatility所有需要的数值有限后才判断 |
| dimension_deferred | unsupported | relative固定结果；不假装数据问题 |

共享prepare多问题同时出现时保留既有代码校验顺序，不重新排序改变原Signal/coverage。成功Prepared后的State附加顺序：time>0→future_evidence→stale_evidence→各维度指标；RMS先数值完整性再基线、再ratio。新State的枚举不能反向改变旧coverage的宽泛readiness分类。

## 6. Validity and invalidation

1. 先runtime gate：offline优先，其次enabled=false→paused，now缺失/非有限→waiting；不沿用旧current分类。恢复使用当前snapshot重算。首版不建立旧state缓存；失效时classification=null，避免旧标签冒充current。
2. 复用既有prepare全部条件，不降低其门槛：quote identity/error/正有限price；fetch<=2min、quote<=3min、未来quote/fetch容差<=1min；非crypto session open且delay<=2min；history来源/币种一致、fetch<=2min、interval为USDT15m/其余5m；连续完成后缀至少22点。
3. 完成点在上游准备中要求barEnd<=quoteAt、USDT confirmed=true；Yahoo的confirmed按15m生成，现有prepare按实际5m推断完成，State不能改用其flag。支持真实连续后缀而非全数组插值/排序补缝；乱序/重复会切断后缀，后缀不足22→insufficient，较早被排除段不参与结论。无效close/time在使用段内拒绝，gap不跨越。
4. **State追加严格当前证据约束**：参与点time>0、barEnd<=now；prepare允许quote轻微领先，因此若其已接受后缀含未来结束点，State拒绝为future_evidence，不能使用未来点或悄悄改Engine。正常未完成bar仍由prepare排除。
5. latestEnd必须满足`now-latestEnd <= intervalMs + 60_000`（复用Engine已有最近完整K线容差/证据freshness尺度，以共享常量表达，非45分钟Signal lifetime）；同时保留prepare对quoteAt-latestEnd约束。quote新到不能续命旧history。等于边界允许，越界即stale。source/history的fetchedAt绝非evidenceEndAt。
6. State对原prepare结果额外检查事实/样本数，不复制一套报价/session/relative验证。Direction与volatility共用有效序列；baseline太小仅关闭volatility，direction可继续。未启用relative不影响另外两项。
7. 旧事件在useRadar effect前可能短暂保留：State完全不读events/coverage/selectedRadar.freshness来决定分类或data freshness，故旧事件不能给新symbol背书。UI将状态与原Context事件分组，不能用事件freshness覆盖State。首版不在State里复制event引用；事件仍由原Context输出。

## 7. Minimal extraction / invariance gate

允许候选：新增单一 `lib/radar/market-input.ts`，从engine机械移入Prepared类型、prepare逻辑、共享时间常量、simple returns/RMS。内部校验可输出结构化reason+原文，Engine薄适配器保留原返回字符串/coverage映射；条件、顺序、截断、数值运算次序、Signal阈值、ID/cooldown/lifecycle不得变。

State模块只调用共享prepare和指标事实，再执行上述State附加规则。此共享边界不去调用scanRadar/evaluate，不重跑Signal pipeline。两维度已足够，不提取relativeReadiness/pair builder，也不把intelligence塞入workflow。

只读发现（不是已执行复现或批准修复）：
- engine.ts:48/57未来quote容差可使now后<=60秒bar被prepare接受；State严格附加约束，不暗改旧Signal。
- relativeReadiness与detector本来有不同末根同步和参考样本门槛，股票最低pairs表述16与detector实际至少18不同；现有22点通常掩盖。
- benchmark落后一根时relative计算最新共同pair，但顶层signal.evidenceAt仍可能取asset最新bar；不得给State沿用该时间。
- 当前RMS是simple-return RMS，当前4/基线16不重叠；rms自身不保护空数组/溢出。State追加有限值guard，旧detector不改语义。

Slice A验收必须对固定基线8a79166生成的scanRadar/coverage结果进行等价对比：已有detector、gate、evidence、ID、生命周期、无变化identity语义一致。不能把原算法复制进生产或用新实现生成自己的golden。若机械提取无法维持等价，停止Slice A缩小/重新规划，不顺手修旧relative问题。旧问题如需处理按独立QA范围/审计，不藏进2.5。

## 8. Integration / allowed paths / cost

共同持有者app/market-radar.tsx：单一useMemo派生selectedState，依赖selected、相关quote/history引用、now、hydrated/mayRun/online及固定ruleVersion。不要因Event/watch/alert数量变化重分类；symbolKey因用户操作导致真实缺失数据变化时依法降级。若memo仍收到同值新对象只会做O(80)纯计算，不复制store或引入复杂hash缓存。

Classic原Radar awareness附近增加克制一行状态+实际观测窗口；Radar现有details增加两个维度证据与限制，默认折叠。通过同一selectedState对象，必要单一presentation helper只格式化，不另算金融事实。无事件也可见状态；原按钮、hash/range、事件/用户提醒独立。继承三档动效、focus和44px，五视口不另开大页面。

Gate满足后允许产品路径：lib/radar/{market-input,asset-state}.ts、engine.ts的机械提取导入、必要types.ts；app/market-radar.tsx的共享派生/props；components/radar/{asset-context,radar-feed}.tsx；app/radar.css的局部规则；tests/radar-engine.test.mjs、tests/radar-intelligence.test.mjs、必要tests/radar-asset-state.test.mjs和tests/browser/radar.mjs；docs/{ASSET_INTELLIGENCE,INTELLIGENCE,CURRENT_STATE}.md及必要单份状态契约、任务卡。

**上述路径已按记录的隔离实现授权开放。** 不改API/market-data/okx/monitor/worker/认证/数据库/依赖/部署配置或Chart手势。无需更换栈或新Skill。

请求预算（代码推导，未实测2.5）：默认10个用户相关symbols（8自选+2独立概览指数），新增既有helper QQQ/000300.SS/^HSI后共13；其中USDT3、Yahoo10。每次全refresh既有1个crypto组(<=20)+3个stock组(<=4)=4个quote API；crypto5s/stock15s分开poll，不能按每5秒4次计算。USDT trends三条1d历史/60s，已有selected chart请求独立计算。2.5相对此全部增量 **symbols=0、quote requests=0、history=0、benchmark=0、API=0、timer=0**；用户扩展watchlist的既有请求不算State新增，最坏State新增仍0。

计算预算：selected至多80点准备，方向20段、RMS20段，无全资产state循环。实现后同fixture/硬件做预热多轮对比（至少1000调用、6轮，报后5轮中位数及规模），主bundle与基线同命令构建比较；目前只有复杂度估算，不能声称已测提升。导航增量实验固定clock明确标隔离，生产不冻结。>8KB新增主chunk或可复现交互/请求回归时调查，不因既有>500KB告警自动Optimizer。

## 9. Slice order / test matrix

A共享边界+旧Engine等价 → B方向/RMS逐个纯函数 → C同源最小UI → D必要浏览器/集成+独立审计。每片稳定后再扩大；不写原型绕Gate。

| 类别 | 固定预期 / 反例 |
| --- | --- |
| 无事件慢方向 | 22个等步缓升price：股票步长约0.02%、crypto约0.035%，20段累计跨floor、ER=1；即使无异常事件仍upward；反向downward |
| 来回/方向反转 | 同量往返净0但路径>0→no_direction，不叫震荡；明显方向但净不跨floor→no_direction；反转使ER低不因单次涨幅变趋势 |
| Direction边界 | abs(net)在floor前/等/后，ER在.60前/等/后；符号两侧、平价path0；min21准备不足/22刚好/80充足 |
| RMS边界 | 当前4与此前16逐项手算，不重叠；ratio在2/3和1.5前/等/后；B=0、=1e-6%、略大；C0/B有效→lower；极小价格/溢出拒绝非有限 |
| 数据时间 | 实际5m/15m、未确认USDT、未完成、未来barEnd(now,now+60s]； quote与history各旧、source/currency/session错、午休/隔夜/gap、重复/乱序后缀足/不足、时钟边界前/等/后 |
| 不可判断隔离 | baseline不足只降volatility；相对基准缺失/旧/错币种/来源/session/interval不改变两维度（首版不消费benchmark）；relative deferred不填中性 |
| 事件/用户独立 | 同data/now/rule下events为空/增删/重复/重排、watch/alert/排序/会话重建均不改变金融结果；不突变输入；无DOM/random/内部实时钟 |
| 更新/运行 | pause/offline→分类null；now越界而无新quote→stale；恢复、快速symbol切换与旧effect结果不能冒充新状态；新quote不能续旧history |
| 老Engine/导航 | 等价输出+既有test；原信号/Confidence/Cluster/Ranking/Asset Context、基准helper、事件引用、原symbol和手动range保持 |
| Browser | existing loopback harness：有效无event、单维缺失、stale/empty/slow、benchmark-error、快速切换、watch/alert/filters不变金融分类；同symbol两端一致、五视口、focus、details默认闭合、动效3档+storage故障 |

测试路径以实际存在为准：workflow与Asset Context相关用例集中在tests/radar-engine.test.mjs，不能假设存在radar-workflow.test.mjs/asset-intelligence.test.mjs。Radar integration/intelligence相关用例按targeted rg定位。保留pageerror与console warning区别。

Planner阶段不跑产品测试。Builder阶段先Node受影响用例；之后 `node node_modules/vinext/dist/cli.js build` → `node scripts/typecheck.mjs` → `node --experimental-strip-types --import ./tests/register-types.mjs --test tests/*.test.mjs`（PowerShell环境实际确认通配符支持后执行；必要枚举文件参数）。package.json的npm test已经串联build/typecheck，全量时不可重复两套包装。浏览器用实际Playwright路径和本地端口，RADAR_MOTION=1/RADAR_INTEGRATION=1，2.5专项复用同harness，不能连接生产。

2.45生产/真机证据另表，不等于2.5新UI通过。后续若新增详情文案需真机，仅要求新状态窗口/限制在原第5步位置的增量检查，不重做无关全套。

## 10. GPT/DS / audit / handoff

- GPT协调者：Planner调查、阈值/数据/架构决策、Gate和任务索引；Gate后按Builder完成两维度、集成与验证。
- 现有GPT只读辅助审查：engine内部边界、RMS/relative窗口与测试路径；未运行测试，代码推导不冒充复现。只读无共享树写冲突。
- DS本轮未调用；已读DEVELOPMENT_PROVIDERS现有边界，没有必要或具体授权的外发载荷，不因历史成功假定当前参与。不改Provider。
- 最终独立GPT审计在实现Gate满足且stable diff时重点看Gate、事件独立、未来收盘、窗口/单位、部分失效、memo/旧symbol、共享提取等价、请求与真实授权。Planner本文可另做只读边界复核，不称产品独立验收。
- 初始Planner没有产品代码/新测试。后续在明确隔离授权后进入Builder，实际实施证据见下；没有发布授权。
- Planner独立只读复核发现2项P2契约歧义（数值失败优先级、reason映射）和1项P3表述（RMS商/下标）；已在本文修正，未涉及产品代码。复核不是实现验收。

## 11. Execution / evidence — 2026-09-22

### Source, scope and roles

本地分支 `codex/mr-market-state-25-builder`，HEAD仍为 `8a79166512d26d958c5ad380b2e3977cb2265d1f`，本任务产品/测试/文档为未提交diff，未覆盖任何起始用户改动。稳定产品与测试文件SHA256见 `outputs/market-state25/source-manifest.json`（本地忽略产物，不含凭据）。没有commit/push/merge/tag/deploy。

实际完成：共享原准备边界、selected-only方向结构与RMS波动、单一父级memo、Classic摘要、Radar折叠解释、来源/时间/限制、相关测试及文档。连续相对状态Deferred；原relative事件和全部Signal/Confidence/Cluster/Ranking/lifecycle不改。未知benchmark不猜测，docs/INTELLIGENCE只纠正旧描述。

GPT协调者完成Planner/Builder/集成，独立GPT `asset_intelligence_audit` 完成只读审计与FIX VERIFY。DS实际调用0次、采纳0项；本轮不强制外发，不改Provider。Optimizer因主chunk增长超过任务卡8KB门槛做定向调查，未做优化代码改动。

### Actual commands / tests

PowerShell；Node v24.19.0；独立headless Edge 149.0.4022.98。测试日期本轮2026-09-22，浏览器均为localhost fixture和桌面视口模拟，不是生产行情或iPhone Safari。

| 项目 | 实际命令/范围 | 结果与证据 |
| --- | --- | --- |
| Slice A引擎回归 | `node --experimental-strip-types --import ./tests/register-types.mjs --test tests/radar-engine.test.mjs tests/radar-intelligence.test.mjs` | PASS，38/38；提取后、State集成前 |
| 原源码等价 | 同Node入口运行 `outputs/market-state25/equivalence.test.mjs` | PASS，33/33场景；从8a79166导出原engine，仅改import路径，每次scan/coverage/benchmark调用对原版与当前版deepEqual；含ID/evidence/生命周期/去重等。baseline算法只在忽略outputs，不进入产品 |
| 两维度单测 | 同Node入口运行 `tests/radar-asset-state.test.mjs` | PASS，15/15；确定性/冻结输入、无事件、往返/平价、方向门槛两侧、效率/ratio含等值边界、基线零/近零、样本、gap/重复/乱序、未来/未收盘、失效/恢复、错误基准隔离和溢出。methodId断言在FIX后复测 |
| 构建 | `node node_modules/vinext/dist/cli.js build` | PASS；最终FIX后重跑。保留既有>500KB告警 |
| 类型 | `node scripts/typecheck.mjs` | PASS；最终FIX后重跑。首次失败来自忽略outputs中baseline.ts使用.ts导入后缀，改为现有Node resolver支持的无后缀后通过，无生产类型缺陷 |
| 全量 | `node --experimental-strip-types --import ./tests/register-types.mjs --test tests/*.test.mjs` | PASS，98/98；最终FIX后重跑，含15新增，未声称执行npm test包装命令 |
| FIX相关 | 三个radar test文件同Node入口 | PASS，53/53；在最终全量前确认两项LOW修复 |
| 综合浏览器 | `RADAR_STATE=1 RADAR_MOTION=1 RADAR_INTEGRATION=1`，随后 `node tests/browser/radar.mjs` | PASS，62项（14新State+48原矩阵）。报告 `outputs/market-state25/browser/verification.json` |
| 同条件视觉/告警复查 | 同脚本 `RADAR_VISUAL_PHASE=before25/after25`，baseline 5177/候选5176 | PASS；同normal fixture/时间、1440×1000与390×844、同展开状态；`outputs/market-state25/{before,after}/` |
| 格式 | `git diff --check` | PASS；仅CRLF转换提示，无空白错误 |

浏览器入口使用本机既有Playwright模块，`RADAR_PREVIEW_URL=http://127.0.0.1:5176`、`RADAR_OUTPUT_DIR=outputs/market-state25/browser`。各环境变量在PowerShell以 `$env:NAME='value'` 设置。脚本仍有loopback强制guard；fixture访问Cookie、行情、storage写入只在可丢弃本地context。生产只尝试独立门禁，未把fixture脚本指向生产。

新用例调试失败均记录为harness修正：BTC无自身基准应显示部分覆盖，而非预设“暂无事件”文案；周线应等`.price-chart`，不是仅15m/1d的`.candle-canvas`；focus-visible先用键盘模式；断网须setOffline改变navigator而非只发事件；slow场景等hydration后的waiting，不能读取尚未启用监控的SSR瞬间paused。未降低产品断言或改变算法来掩盖失败。

### Browser / visual findings and limits

五视口1440×1000、768×1024、390×844、320×740、844×390通过：无非预期横溢，默认折叠、44px/键盘焦点、无事件但有效状态、同源事实、手动周线往返保留、固定观测窗口、换symbol、Watch/Alert独立、offline/recovery/pause、flat/stale/history-stale/empty/error/benchmark-error/slow降级。原三档动效、实际运行halo取消、刷新保存、存储失败/缺hydration、导航与提醒fixture回归也通过。

`pageerror=[]`；console记录**73条**，不是零控制台问题：52条Recharts初始化/隐藏容器尺寸warning，15条fixture monitor401，5条故障fixture503，1条故意中断资源ERR_FAILED（noHydration用例）。独立同条件baseline/candidate视觉往返各10条：2条fixture401 + 2条尺寸−1 + 6条尺寸0，内容/次数相同，确认这条路径的Recharts提示不是2.5新增。未开展全站图表尺寸重构，不据此声称所有warning已消失。

已实际查看桌面、390px手机、320px展开详情截图；每个视口均自动检查滚动宽度及返回/展开操作。State加入后手机完整展开详情更长，原生滚动与返回按钮仍可到达，默认折叠保持；没有删掉风险/覆盖/时间数据压低高度。截图清单：
- 同条件前后：`outputs/market-state25/before/{desktop,mobile}-{chart,context,overview,watchlist,settings}.png` 与 `after/` 同名。
- 新状态五视口：`outputs/market-state25/browser/state25-{desktop,tablet,mobile,narrow,landscape}-{classic,details}.png`；gentle fixture展示无异常事件的方向。
- expanded详情全页截图含固定dock在捕获视口位置，不代表页面其他部分无法滚动。不是iPhone触控/软键盘真机证据。

### Request / performance / optimizer decision

代码检查新增symbol/Quote/History/benchmark/API/timer均0。既有请求/周期/后台策略未修改。浏览器受控时钟、完成显式symbol/range请求后，重复进入状态依据/展开/返回新增API **0**（stateNavigationRequests=[]）；原两个导航增量实验也0。此为隔离实验，不是冻结生产polling的测量。

baseline在独立detached worktree从8a79166、同依赖/同构建命令重建；候选最终FIX后构建。主chunk **736,205→745,022 bytes，+8,817（约1.20%）**，gzip **224,347→227,249，+2,902 bytes**。产物名和对比见performance.json。调查见bundle-investigation.json：入口共享imports不变、依赖/锁文件无diff、client模块3213→3215，仅新增market-input/asset-state；增长来自选定状态计算、结构化失败契约及摘要/解释UI文案，无新的图表/动画/模型依赖。首屏需要状态而现有详情同模块，未证明额外拆包的净收益；不做dynamic import散布或无关瘦身。

Windows/Node24，固定80根15m、单资产、预热1000次后30批×1000调用；`outputs/market-state25/measure.mjs` 与 `performance.json`：State单次批均值中位约**0.0049ms**，批均值p95约0.0076ms；原Engine约0.0158ms、Engine+State约0.0153ms。组合反而略低属于微基准/JIT噪声，不能宣称提速；State独立耗时与小量包增未揭示可复现瓶颈。不是手机FPS/浏览器render成本承诺，不进入优化改码。

### Audit / QA / production / next step

独立GPT固定diff审计：BLOCKER/HIGH/MEDIUM=0，LOW=2（维度判别联合、methodId契约遗漏）。Builder仅修这两项及断言；独立FIX VERIFY确认两项关闭、无新增finding。审计员读取62项浏览器/测量结果，未自称重跑它们。独立最终证据/文档VERIFY通过：9个产品/测试文件SHA256匹配，浏览器/基线告警/测量/授权与完成判定准确，无剩余finding；审计员未重跑测试或浏览器。

| 范围 | 状态 | 依据/限制 |
| --- | --- | --- |
| 2.45 QA-A生产登录后路径 | BLOCKED | 用户当前无法使用Edge，无授权工作台；平台succeeded/门禁可达不替代 |
| 2.45 QA-B原iPhone第5步 | PASS | 用户明确报告iPhone16 Pro/iOS26.2、正式2.45四项正常；原其他5步历史PASS保留 |
| 2.5约定本地实现/回归 | PASS | 本地有效状态、局部失效、同源UI、98 Node /62 browser/build/typecheck/FIX VERIFY；受明确缺口隔离授权 |
| 2.5新增UI真机 | NOT RUN | 仅桌面Edge五视口；后续只需在原第5步位置补看状态窗口/证据/限制和返回，不重做无关全套 |
| 2.5生产验证 | NOT RUN | 未发布，不能要求先发布来充验收 |

**现有生产是2.45/Sites v22；本轮2.5未重新发布（NOT DEPLOYED），未push/merge/tag。** QA-A仍单独开放，不全面封版。连续相对表现、全资产/多周期状态、历史/后台/AI继续Deferred。下一步由用户决定补生产安全登录/新增真机检查，或另行批准上传/发布；既有授权不自动延伸。
