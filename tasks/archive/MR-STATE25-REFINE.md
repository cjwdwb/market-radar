# MR-STATE25-REFINE — scoped quality pass

2026-09-22。约定本地范围实现、测试、独立审计修复及VERIFY完成，已归档。用户要求“优化一下，检查检查哪里不足，之前的未认证的不用管了，全面推进”。这解除旧QA待补对本轮本地优化的阻塞，不把它改为PASS，不修改认证，不代表push/merge/deploy授权。

## Baseline / preservation

HEAD 8a79166512d26d958c5ad380b2e3977cb2265d1f + 上轮已验证的2.5未提交成果；从codex/mr-market-state-25-builder延续到codex/mr-state25-refine。全部已有修改保留。前版本报告tasks/archive/MR-MARKET-STATE-25.md，98 Node/62 browser是历史依据，本轮新增证据单独记录。修改相关文件的任务起点副本与SHA256在忽略的outputs/state25-refine/baseline与baseline-manifest.json，审计比较本轮增量，不能将整个2.5 diff算本轮新增。

现有生产仍2.45/v22/6804b41；本轮不访问生产登录、不改真实数据，不复问旧QA授权。旧QA-A保留BLOCKED历史事实，状态为用户决定本轮不跟进、不阻塞。

## Findings / chosen scope

1. 折线图YAxis对绝对值<1一律最多4位小数，极小有效价格显示0（例如1.03e-8）；>=1也只显示整数。改用已有price精度规则，长刻度科学计数，缓存formatter，不改变价格数值。
2. ResponsiveContainer在隐藏Classic/首次挂载时尺寸0/-1；上轮同条件前后各8条此类warning。检查当前Recharts自身responsive能力，替代冗余外包装，不伪造尺寸、不屏蔽console、不换图表库。保持图表DOM/数据/周期、容器高度和键盘/Tooltip功能，验证往返及resize。
3. 2.5 expanded资产详情手机约1568px，方法/阈值/来源全部同层，关键覆盖说明靠后。保留主要事件与真实净变化/RMS指标、失效/低风险限制；把方法/完整窗口/来源放原生嵌套details默认折叠，所有数据仍可展开查阅。不只靠缩字号或删内容降低高度。
4. 检查首屏加载是否误称用户暂停；若复现，只调整hydration前State的运行输入，不改用户pause/offline优先级。

非目标：新Signal、连续相对表现、金融算法/门槛/有效性改动、全市场/多周期/后台/AI、认证、数据库、Provider改造、依赖升级、全局视觉重做、自动发布。

## Allowed paths / boundaries

app/market-radar.tsx（State启用输入、AreaChart/刻度）；app/radar.css（本次详情样式）；components/radar/asset-context.tsx（层级，必要radar-feed.tsx props）；lib/market.ts仅价格刻度格式函数；tests/market-data.test.mjs、tests/rendered-html.test.mjs、tests/browser/radar.mjs；任务/QA索引、docs/CURRENT_STATE.md及ASSET_INTELLIGENCE.md。

不写lib/radar算法/行情网络代码、K线手势、依赖/锁文件或任何外部配置。无新增provider symbol/API/timer。formatter只展示已有价格；面积图使用已安装Recharts的responsive能力。

## Validation / workflow

Planner → Builder → 受影响测试/浏览器 → Optimizer（已有可复现尺寸warning，范围仅上述）→ 独立GPT Auditor → confirmed fixes → VERIFY。

先用现有loopback fixture捕获任务起点正常状态手机/桌面对照、console；新增极小价格、无hydration、面积图隐藏/返回/resize用例，不能把fixture指向生产。五视口1440×1000、768×1024、390×844、320×740、844×390：主指标/限制默认可读，方法展开无裁切、44px、keyboard/reduced-motion；chart真实SVG和tooltip/keyboard，旧range往返保留，零导航额外请求。统计尺寸warning前后，不把非尺寸的fixture401/503算产品失败或隐藏。

相关Node后build/typecheck及必要全量/62项回归按实际改动执行，避免同diff重复全量。记录命令、对象、失败/修正、数量、截图、bundle、限制。无需测FPS，无测量不声称提速。

GPT负责决策/实现/独立审计。DS不强制：既有2.45第二次具体实现契约外发被拒，当前无新具体外发授权；本轮不重试/换通道，简单本地整理由GPT完成。不新增Agent/Skill/Provider。

## Execution — new evidence

本轮执行对象：此前2.5本地候选+上述局部精修，未提交，未发布。源码文件快照是任务起点副本，未回滚上一任务成果。固定候选SHA256见outputs/state25-refine/candidate-manifest.json。算法文件lib/radar/{asset-state,market-input,engine,intelligence,workflow}.ts相对任务起点没有新改动。

### Confirmed before / implemented after

| 问题 | 修复前本轮证据 | 实际修复与复测 |
| --- | --- | --- |
| 极小价格刻度错误 | tiny fixture完整行情价约1.03e-8，四个刻度实际都是0 | chartPrice复用price，有需要时科学计数；四刻度0.00000001 /1.01E-8 /1.02E-8 /1.03E-8，非零且不同；普通价格100.25保留小数。仅展示，不改数值 |
| 图表尺寸warning | 五视口、周线往返/resize/键盘与tiny场景共36条width(0/-1)警告 | 移除ResponsiveContainer嵌套，使用已安装Recharts AreaChart responsive；相同专项0条，真实SVG可见、resize/返回后曲线可见，键盘Tooltip可读；没有伪造宽高、卸载行情或屏蔽console |
| 手机详情层级过长 | 390px外层展开1567.70px、320px1740.97px | 首层主事件+状态实值+限制，方法/阈值/完整样本/时间/来源默认内层折叠，390px1114.22px（约少29%），320px1216.09px；全部内容仍能键盘/44px控件展开 |
| 加载误标用户暂停 | 禁止脚本、SSR维度为paused | 仅调用方hydration前输入enabled=true、now尚未就绪，得到waiting；hydration后继续使用mayRun，保存的auto=false仍paused。算法和pause/offline优先级不变 |

### Actual validation

环境：Windows、Node v24.19.0、headless Edge149.0.4022.98、localhost:5176、独立fixture context。五视口1440×1000/768×1024/390×844/320×740/844×390。不是生产、WebKit或iPhone真机；按用户本轮决定未安排旧QA补证。

1. `node --experimental-strip-types --import ./tests/register-types.mjs --test tests/market-data.test.mjs`：PASS 7/7，新增1条价格刻度用例涵盖tiny、负数、正常小数、大数、0/无效值。
2. `node node_modules/vinext/dist/cli.js build` → `node scripts/typecheck.mjs`：PASS；仍有既有>500KB告警。未宣称执行npm test包装命令。
3. `node --experimental-strip-types --import ./tests/register-types.mjs --test tests/*.test.mjs`：PASS 99/99，SSR等待文案断言也在本轮新增。
4. 现有`tests/browser/radar.mjs`增加`RADAR_REFINEMENT_PHASE=before/after`，相同fixture/窗口/路径。before7项采证、最终after9项验证PASS（增加保存暂停偏好及320px大额窄区间刻度检查）。before/after报告在outputs/state25-refine/{before,after}/verification.json；pageerror均0。最终9项在下述审计LOW修复后执行，涵盖五视口往返/resize/键盘、tiny/large刻度与SSR。
5. `RADAR_STATE=1 RADAR_INTEGRATION=1 RADAR_MOTION=1`运行同脚本：PASS 62项；三档动效/实际halo取消/存储失败、State/旧Signal/Watch/Alert、周期返回、五视口无横溢等。`outputs/state25-refine/regression/verification.json`：pageerror0，3个受控时钟的导航/展开实验API增量0。不是生产polling测量。这62项在审计LOW修复前执行；最终刻度精度/轴宽修复后重跑build/typecheck/99 Node及9项专项，未重复完整62项。
6. 现有`RADAR_VISUAL_PHASE=refined25`单独稳定截图：桌面/手机PASS，outputs/state25-refine/visual。实际查看tiny价格修复前后及手机详情，主要指标、基线不足/风险、方法入口与覆盖说明完整。完整出处可滚动/展开查看，无固定高度裁剪。
7. `git diff --check` PASS（仅正常CRLF转换提示）。

PowerShell变量均使用`$env:...`；Playwright引用本机既有C:/Users/施文唐/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright，无新依赖。browser loopback guard保留，故障/认证/存储fixture仅隔离本地，未改生产数据。

用例调试：首次专项过早读取尚未加载的Radar基线，修为等待实际active事件后采样；首次tiny selector不适配当前Recharts tick-label层级，修正selector后明确采到4个0，再改产品。不是用改fixture消除缺陷。嵌套details后旧用例定向到外层summary，并新增内层展开断言；原完整证据断言仍运行。

### Performance / warnings / limitations

本轮新增symbols/API/timer/dependency均0。尺寸warning专项36→0；综合62项的console共21条：15条测试monitor401、5条故障fixture503、1条脚本故意中断的ERR_FAILED，无Recharts尺寸warning。没有说“零控制台错误”。

关闭长期运行的Vite预览时，终端累计日志另出现`Detected multiple renderers concurrently rendering the same context provider`及内部`GET / 404`记录。它们未作为浏览器pageerror进入上述报告；未定点归因或证明为用户页面故障，保留为开发环境疑点，不据浏览器errors=[]宣称SSR/终端无告警。本轮不改框架/Worker路由。

相同依赖、同构建命令，前一个已验证2.5构建主chunk745,022 bytes/gzip227,249；最终本轮740,566/gzip224,917，即减少4,456 /2,332 bytes。详见outputs/state25-refine/bundle.json。没有帧率测量，不据此宣称FPS提高；Optimizer仅按已复现尺寸问题改现有组件使用方式，没有展开全库优化。

截图：before/after目录有五视口{name}-context.png、{name}-chart.png与tiny-price.png；visual目录另有桌面/手机稳定截图。高度变化比较的是外层同为展开、方法层按新设计默认折叠的阅读状态，不谎称删除了内容或比较同样全部展开高度。

### Independent audit / scoped fix

独立GPT Auditor对任务起点副本与稳定候选只读审查，初审无BLOCKER/HIGH/MEDIUM，发现1 LOW：4位有效数字的科学计数会把1,000,000/1,000,100/1,000,200显示为同样的1E6。Builder仅修该finding：保留15位有效数字，YAxis使用现有auto轴宽；增加上述窄区间及1e12+100/200的不同值/roundtrip断言，并在320px验证所有轴标签独立且不溢出。最后build/typecheck/99 Node、9专项均PASS。没有降低测试断言、修改金融数值或扩大功能。

独立GPT VERIFY：PASS，无新增已确认问题。Auditor实际定点调用确认百万/万亿窄区间值不同且准确还原，核对Recharts auto轴宽实现、320px截图/断言及最终9项报告；8个候选文件SHA256全匹配，bundle数值一致。Auditor未自行重跑完整浏览器/build/99 Node，读取的是Builder真实运行记录；生产、真机与所有极端数值组合未覆盖。LOW已关闭，未解决confirmed findings为0。

GPT完成Planner/Builder/Optimizer检查及独立审计；DS调用0次，不重试此前被拒外发。残余：原大chunk告警、当前候选未做真机/生产验证、连续相对表现仍Deferred。旧未验证事项按用户决定不再作为本轮阻塞，不把记录改PASS。

现有生产2.45/Sites v22；本轮本地优化未commit/push/merge/tag/deploy，未改访问策略、密钥、数据库。
