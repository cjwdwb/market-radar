# 官方信息入口交付（2026-10-03）

后续发布说明：本报告记载的FED本地成果已于2026-10-03随Sites v32/source 4a4b7fb66ac4fc10663087b42a09e08c55804e2a上线；[联合交付与限制](INFORMATION_SOURCES.md)。以下“本轮未发布”保留原阶段事实。

任务[MR-29-INFORMATION-DELIVERY](../tasks/archive/MR-29-INFORMATION-DELIVERY.md)已本地验证归档；独立 `codex/mr-29-information-delivery` 工作树，源码基线 `2ad86814abf5a0f40c50d7ad463d1de6633a859f`，本轮未提交。现有生产仍为 **Sites v31 / c28de66a26237d760d67f839fecbbecfc3eb4a4e**；本轮未 push、部署、开通资源或启用调度。minute29 未提交成果未改动；不关闭真实分钟历史等 2.9 待办。

## 使用与来源边界

Radar → 官方宏观资料：首次展开读取站点已保存资料，不再必须导入文件。保留文件导入、UTC筛选、五条分页及出处。失败、坏校验、超限保留上一份有效资料和筛选；取消/新导入使旧异步响应失效。首次展开一个同源请求，重开/筛选/翻页不请求，刷新按钮才再次读取快照，不采集外部来源。

本次只接通 **Federal Reserve Board货币政策RSS元数据**，不是全部新闻、币圈项目消息、公司公告或价格原因解释。保留来源核对截止、发布日期、首次/版本入库与导出时间；超过截止24小时在展开/操作时提示维护更新，无新timer。记录仍是reconstructed/current-vintage，不是PIT或当时在线观察。

新增GET `/api/information`继承原门禁，固定读取已审核构建输入 `data/published/fed-monetary.json`，拒绝参数，不开放URL/SQL/路径/数据库。复用1MiB/200条/31日/版本摘要校验。公开包没有owner、run、来源账本或原响应。

修复 `fedConfig` 固定九月起点在10月超过31日而失败的问题。新手动run冻结 `[max(2026-09-01, cutoff−31日), cutoff)`；这是当前RSS快照窗口，不改旧批次/事实，不缩减历史回补目标，不扩大限额。

## 真实执行与保存

| 项目 | 本轮事实 |
| --- | --- |
| 许可核对 | 2026-10-03T12:41:02.456Z FED disclaimer HTTP200，85,130字节；除特别标明外public domain、可复制分发、须署名Board；只用批准元数据，不用徽章/第三方正文 |
| 其他源 | Ethereum博客连接失败，旧terms地址301，未确认博客许可；未绕行或接入 |
| 文档请求 | 3次、85,130已接收字节，与feed请求分开 |
| 原库保护 | 原FED库只读逐表比对旧logical-v2备份；SHA前后不变，没有个人自选/提醒数据操作 |
| 真实更新 | 2次feed请求，各9,645字节，共19,290；沿用原4次请求账本与冷却，没有重置配额 |
| 两批窗口 | `[2026-09-02T12:56:04.379Z,2026-10-03T12:56:04.379Z)`；`[2026-09-02T12:56:06.345Z,2026-10-03T12:56:06.345Z)` |
| 数据 | 每次端点15条，窗口内2条/窗口外13条；每次新增0、重复2，未伪造新资料 |
| 内容 | 2026-09-16T18:00Z FOMC statement和经济预测；首次入库仍为2026-09-22，未重写为今天 |
| 公开版本 | revision4；viewId `fca279185741d3455885c9af5de4076ee945dfa96a3c6a8ca7e004c53ce45ba2`；1,781字节 |
| 费用 | 无购买/新订阅，新增订阅费$0；网络/存储账单未核对，不称总成本为0 |

免费非商业用途不等于通用转载许可；本来源依据实际核实的官方声明。只有RSS快照遍历，没有完整公告全集分母，不宣称100%覆盖。

隔离库从已核实旧备份恢复，初始禁采集；本次明确的一次性操作员授权仅临时启用该副本执行两次run，finally恢复 `collection_enabled=0`。常规restore继续默认禁采集，没有新增通用enable CLI；不能在旧/新库并行采集或借复制重置预算。

真实演练：导出9,947字节logical-v2 → 新空库恢复 → 两个独立Node22.15进程逐表/版本/账本/公开查询核对。两库各61,440字节，integrity_check=ok；6runs/4pages/2facts/1source/6source_requests；全表摘要一致 `760fbb9675980a923ea6d6e88010ccd188c8121bf20c7438f5cfc95d54898ea8`，均禁采集、无租约。只验证信息查询恢复，不冒称金融回放。

数据位于 ignored `work/state27/fed-monetary`。原响应、库、备份不进Git；仅许可内公开元数据加入构建输入。没有异地备份，长期保管仍未完成。

## 新测、审计与限制

| 验证 | 结果 |
| --- | --- |
| 受影响Node22.15 | `--experimental-strip-types --import ./tests/register-types.mjs --test tests/information29.test.mjs tests/fed-history.test.mjs`：19/19 PASS |
| 全量Node22.15 | 同入口 `--test tests/*.test.mjs`：376 PASS/0 FAIL/1 SKIP；Windows文件symlink权限不足，junction另有测试，不称377全通过 |
| 构建/类型 | `node node_modules/vinext/dist/cli.js build`、`node scripts/typecheck.mjs`各PASS；既有大chunk警告保留 |
| 最终scoped lint | eslint改动API/组件/脚本/测试：0 errors/0 warnings；不是全仓lint |
| 浏览器 | 既有radar.mjs，RADAR_INFORMATION29_ONLY=1；本机生产等效workerd禁止外部网络/合成登录；Edge149.0.4022.98，17组PASS |
| 五视口 | 1440×1000/768×1024/390×844/320×740/844×390：真实FED快照五组、旧模拟导入五组，键盘/44px/无横向溢出；三档动效保留资产与手动周期 |
| 失败与竞态 | 门禁401、参数400、503/坏摘要/超限不清旧结果；取消/新导入不被迟到响应覆盖；首次失败图表仍可用；过期提示及切回站点快照 |
| 日志 | pageerror=[]；3条console HTTP错误分别来自故意触发的400和两次503，不称无console警告 |
| 独立GPT产品审计及最终VERIFY | PASS，无confirmed finding；独立只读核对原库SHA、两个验证进程、真实响应→公开资料、权限/竞态/时间与窄屏截图，最终文档/DS/测试计数一致；未冒称审计者重跑全量浏览器 |
| 生产/真机/远端CI | NOT RUN，本轮没有上传/部署，不借用历史记录冒充新测 |

`npm test`包装未运行，组成检查分别执行，避免重复构建。浏览器初次脚本预期修正：原Worker实际cache header包含max-age=0；旧示例链接位于新的折叠导入区，应先展开再验证。未降低业务断言。最终证据在 `outputs/information29/{real-run.json,restore-verification.json,node-full.log,build.log,typecheck.log,lint-final.log,browser/verification.json}`；五视口截图同目录。主代理检查桌面/390px，审计者检查320px。周边行情是fixture，不能称生产行情验证。

无测得性能瓶颈，Optimizer跳过；本轮测的是小资料请求边界，不声明FPS、吞吐或组合负载收益。依赖、报价刷新、State/提醒算法、后台timer不变。未演练进程强杀后的本次临时权限回收；现有两个副本已实际关闭，手动续跑前必须复核。

DS实际使用已有deepseek-worker/deepseek-flash，只读三个批准组件/视图/测试文件，8953tokens（费用未核对），未改文件/Provider。GPT采纳代次取消、保留筛选、时间区分、触控和竞态用例；把默认mount请求建议改为首次展开。来源/权限/存储/核心及最终独立审计由GPT负责。

## 手动运行手册

- 查看：Radar → 官方宏观资料。“刷新已发布资料”读取站点版本，本地更新不能自动上线。导入工具只在本页读取文件。
- 本机状态：`node scripts/fed-history.mjs status`。没有常驻服务；本轮两个库均禁采集。
- 准备公开包：`node scripts/prepare-information.mjs`，固定只读canonical库最新成功批次，完整校验后原子替换固定JSON；不网络、不部署。并行准备/残留`.pending`会拒绝，先核对所属任务，不能覆盖未知文件。
- 备份：`node scripts/fed-history.mjs backup fed-monetary/<新文件名>.json`；恢复：`node scripts/fed-history.mjs restore fed-monetary/<备份>.json fed-monetary/<新库名>.sqlite`，不得覆盖原库，默认禁采集。
- 后续有限更新先核对唯一权威库、原来源账本/冷却和授权预算；本次副本临时授权已使用，不能永久开启恢复库。collector的6次/滚动日、256KiB响应等约束保持；不能用新库重置。
- Crypto项目、公司公告/SEC、媒体、更早历史仍待分源许可/实体/时间核验；本次没有LLM摘要或价格因果判断。上传部署/调度需要另行授权。
