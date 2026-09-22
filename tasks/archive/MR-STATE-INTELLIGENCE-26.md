# MR-STATE-INTELLIGENCE-26 — 实施与验收记录

2026-09-22。结论：约定P0/P1本地范围验证完成（PASS）。范围为当前选中资产；本轮2.6不push/merge发布分支/tag/deploy/修改凭据。四份契约经独立GPT只读复核后实施；最终领域与集成独立审计无confirmed findings。产品测试与限制见末尾实际验收记录，不代表生产或真机通过。

## Baseline / authority / roles

HEAD与本轮GitHub API读回main均09338aa6b03affcb01262ad571212797b0590c09；开始工作区/暂存/未跟踪为空。独立开发分支codex/mr-state-intelligence-26。生产记录2.5/Sites v23/31a11d2；本轮没有访问生产。旧QA-B用户iPhone反馈PASS、QA-A历史BLOCKED且用户已取消跟进/不作为Gate，均不改写为本轮验证。

旧99 Node/build/typecheck/9专项为2.5最后候选证据；62综合在最后LOW前，均不是2.6新测试。本轮遵循PLAN→契约复核→BUILD→TEST→必要OPTIMIZER→独立AUDIT→FIX→VERIFY。

主协调负责最终契约/UI/集成，GPT只读子任务已核查输入及relative；核心Builder、独立契约Reviewer/Auditor请求工具公开支持的gpt-6-astra/ultra。本机config只读核对model=gpt-6-astra、effort=high；这不能反证主会话实际档位，本会话无切换/反查有效effort工具，不改全局配置，不声称主会话ultra已生效。子任务参数是已请求配置，不冒称另行反查运行时。DS当前不调用：无必要低风险外发，亦不重试此前被拒内容。独立写任务用独立worktree，仅协调者写ACTIVE。

## Fact map / capability

app/market-radar.tsx拥有quotes/trends、selected/range及10秒时钟；requestKey已有benchmarkSymbols去重分组。useRadar是原Engine/store/intelligence消费者，State不读其events/coverage背书。现有selectedState只传当前asset，2.6仅补传已经加载的映射benchmark引用和memo依赖，不改网络集合。

prepareMarketInput：先quote/session/history/source/currency/age检查，截最多80个完整点再取最新连续后缀，至少22；USDT用15m且confirmed，其他已有quote.points按5m。State额外检查time>0、barEnd<=now、证据年龄<=interval+60秒。顺序、容差和原Engine语义保留。Point无bar级session标记：只能证明响应元数据与连续时间网格，不能声称历史交易所session逐根认证；不跨真实午休/隔夜缺口、不补点。

基准仅原benchmarkFor清单：7个USDT→BTC-USDT、8个美股→QQQ、600519.SS/300750.SZ→000300.SS、0700/9988/1810.HK→^HSI。BTC/基准自身/未知资产不猜映射。Relative readiness与detector历史门槛及尾点不同，保留；新State不得把relativeEligible当充分证明。

## P0 Horizon Contract — elapsed-v1

Horizon专指Direction的close-to-close窗口，同时RMS完整依赖跨度等于H；不是RMS当前观测时长。Short=90分钟，Medium=180分钟，二者以资产最新合法完整收盘T结束。选择真实elapsed time而非同名不同bar-count；最新连续交易片段内elapsed与连续交易时间相同，跨休市不拼接。5m/15m分辨率、样本数不相同，不声称统计可直接横比。

Direction N=H/interval，需要N+1点，范围(T-H,T]的N段收益。RMS current C=H/3、baseline B=2H/3：current(T-C,T]，reference(T-H,T-C]；N段合计，两者收益不重叠。该2:1基线分割是2.6明确的新配置，与2.5的4:16不同；是有界描述性比较，不以两根crypto短窗收益称统计置信度。

| 源 | Horizon | Direction/RMS点数 | RMS current/reference段数 | Direction previous所需总点 | RMS previous所需总点 |
| --- | --- | --- | --- | --- | --- |
| 5m | Short90m | 19 | 6/12 | 37 | 25 |
| 5m | Medium180m | 37 | 12/24 | 73 | 49 |
| 15m | Short90m | 7 | 2/4 | 13 | 9 |
| 15m | Medium180m | 13 | 4/8 | 25 | 17 |

每项还先满足原22点gate；不足独立insufficient，不退到旧尾点/缩窗。USDT已有96点、prepared最多80；Yahoo当日实际点数依session。A股连续2h最多24根、港股上午30/下午36根：Short在22点后可用，Medium37点结构性不足，明确提示；US连续交易可支持Medium，Medium Direction previous需73点约开盘365分钟。A/HK Short Direction previous不足；A股Short RMS previous25点不足，HK可部分时段。无全覆盖承诺。

2.5 buildAssetState保持既有输出、20/4/16、方向效率>=.60、净变化crypto .60%/其他.30%、RMS基线>1e-6%、比值>=1.5/<=2/3、失败优先级和message。只抽单份可参数化数学及State准备供v1/v2使用。v2 Direction效率沿用.60；Short绝对净变化crypto>=.30%/其他>=.15%，Medium>=.60%/其他>=.30%。新窗口按相同市场的固定净变化速率线性放大门槛，避免长窗天然更易过同一底线；未经预测校准，不是沿用v1窗口有效性的声明。RMS比值/数值下限沿用无量纲方法语义，明确新分割并非异常Signal阈值。

## P0 Relative Contract — relative-window-v1 / short90-v1

仅Short90m，N+1精确配对点：5m19、15m7；双方各自先过22点及严格State有效性。用原映射，拒绝自比，metadata market/source/currency/session/interval相容；不换汇，不猜未知映射。共同结束必须等于双方各自最新合法结束（允许落后0根），报价同步仍<=interval，全部期望起点/内部/尾点精确存在，不能按下标/nearest/fill。历史join helper只提取原Map+flatMap事实，旧readiness/detector分别保留原规则/次序/基线。

assetReturn%=100*(assetEnd/assetStart-1)，benchmark同理，delta=asset%-benchmark%，单位百分点，非alpha/财富比。crypto delta>=.30pp为stronger，<=-.30pp为underperforming；其他>=.15/<=-.15；严格之间similar。门槛为Short描述性差异带，无近期异常baseline、不复制Signal的max(.6/.35,median*3)。未配置unsupported；已配置未到waiting；样本不足insufficient；时间过期stale；不同元数据/网格invalid；尾点不齐insufficient。带reason与benchmark输入原原因，无效classification=null。

证据：symbol/benchmark、horizonId=short、method/config、pair点数/段数、interval、closeStart/End、双方最新end、双方quote/fetch/history时间、source/currency/session、真实差值/阈值/单位。benchmark失效只影响Relative，不使用旧Event续命。

## P0 Alignment Contract — state-alignment-v1

参与：short.direction、medium.direction、short.relative；RMS context-only，不能方向投票。记录required/evaluated/missing、closeEnd和每个参与窗口，label由domain提供。无权重/分数/Confidence总评。comparison范围明确为共享尾点的两个方向窗口+仅Short相对参照，不称相对表现确认Medium整段。

先只比较可用且证据尾点相等的结果；不匹配记missing理由。短/中方向↑↓或一个no_direction另一个有方向=已知关系不同；Short↑且Relative underperforming、Short↓且Relative stronger=绝对与相对参照不同。至少一对已知差异优先mixed，仍披露缺失。两方向相同有方向+Relative相同取向且完整=aligned（向下/underperforming也可一致）；无差异但缺失=insufficient；完整且含no_direction或relative similar=neutral（已计算、无共同方向确认），不等于缺失或震荡。

| Short/Medium/Relative | 输出 |
| --- | --- |
| up/up/stronger；down/down/underperforming | aligned（共享数据，非独立确认） |
| up/down/任意或缺失 | mixed，保留relative缺口 |
| up/up/underperforming；down/down/stronger | mixed，绝对/相对参照不同，不称数据矛盾 |
| no_direction/no_direction/similar或有效有向relative | neutral，无方向确认 |
| up/no_direction/任意 | mixed，两个已计算结构不同 |
| up/up/similar | neutral |
| up/up/缺失；只有一个有效维度 | insufficient |
| 标签相同但尾点不相容 | insufficient；可相容已知分歧不因他项失配隐藏 |

## P1 Transition Contract — historical-adjacent-v1

P0稳定后实现Direction/RMS两Horizon及Short Relative。真实now下只准备一次，再在合法连续bars/pairs上用同一纯方法重算；不改quote时间、不把历史锚点作为live now、不读上次render/session/store。

Direction/Relative shift=H；current(T-H,T]、previous(T-2H,T-H]，可共享一个分界close但无共享收益，需2N+1点（Relative5m37/15m13，再过22gate）。RMS shift=C；current观测(T-C,T]、previous观测(T-2C,T-C]，前次baseline(T-H-C,T-2C]、本次baseline(T-H,T-C]，共需N+C/interval+1点。两次baseline共享C时长，新baseline包含前次观测，明确披露，因此类别变化可能来自当前值和滚动基线，非独立样本确认。

current有效、previous不足/数值失败只令该Transition unavailable，不清空current/其他transition，不受Alignment缺失阻断。from/to有相同rule/method/config/interval/source/currency/窗口语义；仅changed/unchanged或结构化unavailable，不输出strengthening/weakening。记录全部窗口、步长、收益重叠0、基线共享说明；不是精确shiftAt、实时发生记录或反转预测。before端点之后数据不参与previous。无独立存储/事件/提醒/timer。

## Public boundary / allowed paths

保留buildAssetState v1及AssetState接口；新增buildAssetStateV2同输入，输出AssetStateV2：symbol/ruleVersion=asset-state-v2/calculatedAt，horizons.short/medium（horizonId、durationMs、configId、direction、volatility、完整evidence），relative、alignment、transitions。数学method direction-v1/rms-v1不变，horizon配置elapsed-v1，relative/alignment/transition各自版本。所有failure无分类，可枚举reason；UI不拼金融事实。

允许lib/radar/asset-state.ts、必要单个asset-state-v2.ts或state-methods.ts（职责需要再决定）、market-input.ts纯配对helper、engine.ts仅机械改用helper；components/radar/asset-context.tsx或必要单个asset-state.tsx、radar-feed.tsx、app/market-radar.tsx仅props/派生、app/radar.css局部规则；相关Node测试/基线fixtures、现有tests/browser/radar.mjs、docs/ASSET_INTELLIGENCE.md与必要STATE_INTELLIGENCE.md/任务索引。禁止API/网络/provider/依赖/锁文件/门禁/数据库/全局动效/图表几何变化。

派生只在父组件一次，使用当前资产及已映射benchmark输入引用，memo覆盖symbol/now/runtime/两侧quote/history，不读事件。Classic紧凑两窗/Relative/关系，Radar默认折叠完整事实；Transition在展开层，不增加常驻大卡片。既有图表range/pan/zoom与State独立。

## Request / compute / validation plan

新增endpoint、前端HTTP、upstream调用、symbol、history依赖、timer全部0；复用已有requestKey/benchmark去重，只扩大State本地输入。计算最多两侧各80bars、两个Horizon、各current/previous，准备/配对不在每个维度重跑。微基准同机固定80bars、相同now/输入、预热1000次后10批×1000，报告中位数/p95批耗时与bundle before/after，非FPS。无实测瓶颈不进Optimizer。

先捕获固定09338aa的v1 State和Engine/coverage/intelligence输出作为仅测试oracle（不复制算法到生产）；20/4/16全结果等价、金融边界/失败顺序保持。新增Node覆盖阈值前/等/后、最小点数、close端点、5m/15m、session缺口/未来/无效/重排后缀、极端数值、relative全映射/零lag/完整grid、alignment真值表、历史无前视、immutable/event/user独立。原信号/store/生命周期/排名suite照常。

浏览器复用loopback harness，RADAR_STATE/RADAR_INTEGRATION/RADAR_MOTION并新增2.6入口；1440×1000、768×1024、390×844、320×740、844×390，查看实际展开State、局部失败/慢/空/旧/快速换资产、请求与手动周期、watch/alert/动效三档/键盘焦点。pageerror与warning分开记录，fixture不连生产。Windows用已验证Vinext build→typecheck→Node分项，不冒称npm test包装通过。新UI真机NOT RUN。

P0：双窗口Direction/RMS、Short Relative、Alignment、证据/失效和共享UI。P1：上述已定稿历史Transition，在P0验证后进入。Deferred：Medium Relative、全资产/多于两Horizon、新映射/请求、session日历、状态历史/AI/预测/评分。各市场样本限制是明确能力边界，不暗自删项。

## 实际实施 / 2026-09-22

P0 与 P1 均实现。领域/测试 Builder 在独立 worktree，主协调集成UI；领域 P0测试106项通过后再补P1。新层 `lib/radar/asset-state-v2.ts` 只派生选中资产；`asset-state.ts` 保留v1并抽共享参数化方法/严格准备；`market-input.ts` 和 `engine.ts` 只机械抽配对 helper。新 UI `components/radar/asset-state.tsx` 格式化同一对象，方法/来源和前后比较默认折叠；主组件只补已加载 benchmark 引用及memo依赖。原事件、Coverage、Watch/Alert、图表周期及动效偏好语义不变。

长期契约在 docs/STATE_INTELLIGENCE.md；更新 docs/ASSET_INTELLIGENCE.md、docs/CURRENT_STATE.md 和任务索引属于此次说明范围。没有新依赖、后端、AI或Provider改造。DS实际调用0；GPT完成调查/契约、两个隔离Builder、集成、独立领域及集成审计。子代理请求gpt-6-astra/ultra；主会话有效effort无法反查，未伪称修改成功。

## 本轮实际验证

全部针对本地未提交2.6候选；HEAD仍09338aa，生产未访问。测试数据只在Node/loopback fixture，不进入产品。

| 项目 | 状态 | 新测与证据 |
| --- | --- | --- |
| 独立测试工作树 | PASS | 最终172/172（119新增suite=81固定旧oracle+38新测试，53既有State/Engine/Intelligence）；工作树只交4个测试文件 |
| 主工作树受影响测试 | PASS | 首轮157项（命令漏列正确的radar-asset-state文件名；不声称此轮覆盖其15项）；随后全量明确包含它 |
| 构建 | PASS | `node node_modules/vinext/dist/cli.js build`；outputs/state26/build.txt；既有>500KB提示仍在 |
| 类型检查 | PASS | `node scripts/typecheck.mjs`；outputs/state26/typecheck.txt。首轮失败来自outputs内上轮旧源码快照；保留移至workspace兄弟目录market-radar-state26-evidence-state25-baseline后重跑通过，未改编译规则/降低断言 |
| 全量Node | PASS | `node --experimental-strip-types --import ./tests/register-types.mjs --test tests/*.test.mjs`，218/218、0fail/skip；outputs/state26/node-all.txt |
| 综合浏览器 | PASS | Edge149.0.4022.98 headless、本地fixture，五视口72项；outputs/state26/browser/verification.json。pageerror=0、chart尺寸warning=0；另有21条console error（fixture401/503及离线失败类），不称console全部为空 |
| 2.6定点复测/真实展开截图 | PASS | 相同产品diff，新增截图/带基准导航测量后重跑10项，非另10个独立新功能；outputs/state26/state26-focused/verification.json，errors=0、warnings=0 |
| 2.5精修回归 | PASS | 9项；outputs/state26/refinement/after/verification.json；五视口详情/图表、极小/极大窄区间刻度、SSR waiting、尺寸warning=0；另有1条console ERR_FAILED，该suite含阻断脚本的SSR检查，不称warnings全空 |
| 生产/2.6真机 | NOT RUN | 本轮不发布，不用本地Edge视口或旧2.45 iPhone反馈替代 |

浏览器命令均为 `node tests/browser/radar.mjs`，PowerShell环境变量：RADAR_PREVIEW_URL=http://localhost:5176，PLAYWRIGHT_MODULE指向本机Codex runtime的playwright，RADAR_OUTPUT_DIR为上表目录。综合使用RADAR_STATE=1/RADAR_STATE26=1/RADAR_INTEGRATION=1/RADAR_MOTION=1；定点使用RADAR_STATE26_ONLY=1；精修使用RADAR_REFINEMENT_PHASE=after。预览 `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5176 --strictPort`。未执行npm test/bash包装，分项结果如上。

五视口1440×1000、768×1024、390×844、320×740、844×390。实际查看Classic摘要、Context展开、指标、Transition截图；无横溢，键盘/44px入口、手动1周往返可用，缺基准/尾点不齐/样本不足/混合关系/时钟失效局部降级。对照数据固定fixture；不作为真实行情或真机证据。

## Request / 性能实测

网络路径/requestKey未改，仍共享原quote批次与benchmark目录；无新增provider symbol、Quote/History/benchmark依赖、endpoint、前端HTTP、上游调用或timer（均指**增量0**，非原有请求为0）。本轮未测真实provider负载。

受控时钟、显式symbol/range请求结束后，两次NVDA/QQQ Classic→Radar→Transition→Chart导航额外API=0，见focused.state26NavigationRequests=[]。原State、Event集成导航实验也为0；fixture中暂停调度，不改变生产polling，不作为线上请求测量。

主协调新测Node v24.19.0/Windows，同一NVDA+QQQ各80点、固定now，每版预热1000、交替10批×1000次：干净09338aa v1中位批2.4255ms/p95批3.4198ms；完整v2中位批16.9728ms/p95批21.2248ms，均摊约0.01697ms/次。p95为10批nearest-rank，不是单次延迟或手机FPS。证据outputs/state26/performance.json与performance.mjs。

主chunk从历史验证2.5基线740566 bytes/gzip224917，到本轮758614/gzip230206；+18048 bytes（约2.44%）/+5289 gzip（约2.35%）。baseline不是本轮重建，源码/依赖与当前固定起点一致；after为本轮新构建。未见值得启动Optimizer的测量瓶颈，保留既有大chunk提示，不为它额外拆分。

## 独立审计

四契约Planner独立复核PASS。最终独立领域Auditor无confirmed BLOCKER/HIGH/MEDIUM/LOW；另独立只读子代理从干净09338aa重新生成81份oracle，81/81与固定文件一致。领域固定asset-state-v2 SHA256=63677CC637A586E823B82FB5DB891EEB5DA4C8D633C0ACA43A4C29784B9800CE。该Auditor未重跑全量测试/浏览器，不冒称它们由审计代理执行。

集成/证据独立Auditor完成（PASS）：核对共享memo/运行状态、已加载基准、请求边界、金融文案、折叠/键盘/触控、手动周期、fixture安全、五视口截图及72/10/9项实际报告，无confirmed findings；未重跑测试，不重复领域数学审计。没有confirmed产品修复，Builder FIX与修复后VERIFY为NOT APPLICABLE。最终文档/证据定点VERIFY为PASS：14个候选文件hash一致，重新核算性能统计/bundle，确认72/10/9未冒称独立合计、历史/新测与生产/真机边界准确；本复核未重跑测试或性能测量。

## 生产与限制

现有生产2.5/Sites v23/31a11d2；本轮2.6未push/merge/tag/deploy。旧QA历史状态不改写，新UI真机NOT RUN。A/HK连续样本、15m短窗少收益段、无逐bar session证明、历史修订和描述性非预测门槛均显式披露。允许当前维度有效而前窗/Relative不足，不扩大请求弥补覆盖。
