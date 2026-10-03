# MR-29-INFORMATION-DELIVERY

2026-10-03，**本地信息入口交付已验证，归档交接**。用户要求自行解决本项目的信息面获取，操作仅限Market Radar；沿用既有流程，不新建版本/Agent/Provider。

## 基线/保留/权限

独立information29工作树，branch codex/mr-29-information-delivery，base2ad86814abf5a0f40c50d7ad463d1de6633a859f。minute29未提交成果原样保留，不混入本轮。既有生产Sites v31；本轮授权本地实现/已批准免费官方源有界采集/验证，不推定付费、账号、生产迁移、定时调度、push/tag/deploy授权。不修改其他项目或全局配置。

## 真实问题

MacroTimeline目前必须下载/重新导入文件，普通浏览没有默认数据。已有FED货币政策元数据来源、SQLite幂等与来源配额、公开视图及两条真实资料。另发现fedConfig固定from=2026-09-01，31日range约束使10月后手动collect失败，需要定向回归确认及修复；不得靠调大范围解决。

## 调查范围/初步交付

优先复用FED真实链路：官方资料默认展示、只读应用接口、保留导入能力、来源/时间/覆盖及过期说明、有界手动更新与恢复。低频核对FED官方免责声明/当前RSS；另核查Ethereum官方博客发布条款，不取得明确许可不接入新源。官方资料调查最多4HTTP/2MiB；实际FED feed最多2HTTP/512KiB（单次≤既有256KiB），固定cutoff、单页、50记录/30秒、并发1，服从既有6/day来源账本与Retry-After。没有自动下一批。

Planner定稿前不改产品。下方契约已完成范围、snapshot/API/更新与失败契约、允许路径及测试矩阵；协调者单写ACTIVE，DS限定非敏感组件/测试阅读，GPT审定来源/存储/核心与独立审计。

## Planner定稿 / BUILD范围

来源决定：2026-10-03T12:41:02.456Z官方Board disclaimer HTTP200/85130bytes，再确认除特别标明外为public domain、可复制分发、须署名；不使用徽章、图片或第三方正文。Ethereum博客GET连接失败；ethereum.org旧terms地址301到/terms-of-use/，未确认博客内容许可，不绕行、不接入。3次文档请求仅85130已接收bytes；本轮只接已有批准的FED货币政策元数据，不承诺加密项目或全部新闻覆盖。

1. 修复`fedConfig`为[max(FED.start, now−31day), now)，now在run创建时冻结。它是当前RSS快照的有限窗口，不是历史回补目标缩减；旧runs/facts/最初9月记录保持。31日查询/200条公开视图/1MiB/6次day来源账本及冷却不变。
2. 保留原项目`work/state27/fed-monetary`不写。在新工作树导入其已核实logical v2备份到同名隔离库；核对原库只读counts/源账本与备份匹配后才执行有限续跑。导入默认禁采集；本次操作员明确启用该副本的单次手动任务，保留全部过去请求/冷却/版本，不并行运行旧库或用副本重置预算。实际feed最多2次合计512KiB（第2次仅确认幂等），每run1request且既有预算约束。
3. 新增GET /api/information只读构建时已审核`data/published/fed-monetary.json`，经过现有parseFedView，private/no-store，拒绝任意查询参数，无URL/路径/SQL/provider访问、无新DB绑定。Worker原访问门禁继续覆盖。静态内容至多200条/1MiB；接口读取不声称重新核对来源或采集。
4. MacroTimeline首次展开懒加载同源接口，默认折叠；重试/手动刷新读取已发布快照，保留导入工具和旧示例。generation+AbortController防止旧响应覆盖新导入/新选择；失败保留上次有效视图及其来源，明确错误，不清空。停止等待可用。无周期轮询、未打开不请求、价格更新不重复请求。
5. 显示一般宏观身份、来源署名/原文、source cutoff、入库/导出时间、覆盖未完整。以source cutoff而非加载时间判断距核对超过24小时的“需更新”，无新计时器（展开/加载/页面操作时更新）；不将旧文件装成实时快讯，不自动关联BTC/ETH或解释价格原因。手动导入明确本地身份。
6. 新增本地prepare脚本：从既有canonical FED库最新成功run导出，经校验后原子写固定公开JSON；不访问网络，失败不替换旧文件，禁止越界/链接目标/恢复库误写，不导出owner/run/原始响应。普通读取没有执行采集的能力。更新/备份/恢复操作写成运行手册。

允许路径：scripts/fed-history.mjs、新scripts/prepare-information.mjs；app/api/information/route.ts；data/published/fed-monetary.json；components/radar/macro-timeline.tsx；app/radar.css必要小样式；相关Node/tests/browser/radar.mjs；任务索引/文档/ignored本轮输出与隔离本地库。不要改collector/schema/source policy/live行情/State/提醒/访问控制。新API在任务卡明确批准范围内，无远程写入。

验收：日期31日边界/未来时间/旧September兼容、只读接口与坏数据局部失败、query无外部请求、浏览器懒加载/重开不重复/取消/错误保留/导入竞态/来源时间说明/五视口/三档动效/原工作流。新真实FED端点响应→SQLite→跨进程读取→备份恢复→公开JSON→本机API/UI至少一条真实记录；若当前feed无新记录不伪造新增，仍展示合法原记录与真实查询窗口。相关测试后全Node22/build/typecheck/受影响lint，独立GPT审计/修复复核；本地验证与线上分列。无性能瓶颈不调用Optimizer。

Planner独立复核接受范围，补充采集收口：隔离副本临时启用后最多2次run，在finally恢复collection_enabled=0并核对账本。异常中断先关闭再处理；常规restore仍默认禁采集，没有新增通用enable CLI。旧库不写，不将本次明确授权的副本临时执行扩大为常开服务；在历史文档注明这个有界例外。

## 实际交接与独立VERIFY

- [交付与操作手册](../../docs/INFORMATION_DELIVERY.md)：批准FED元数据→真实端点核对→SQLite去重→备份/新进程恢复→固定公开包→原门禁API→本地五视口，完整本地链路已验证；没有假新闻或新算法。
- 2个feed请求、19,290字节、0新增事实，原2条资料保留firstReceivedAt；revision4。原库SHA未变，两个本轮库已禁采集，恢复全表摘要一致。未再发请求。
- Node22专项19/19，全量376PASS/0FAIL/1文件symlink权限SKIP，build/typecheck/scoped lint通过。浏览器17组（真实元数据5视口+模拟导入5视口等），3条预期400/503console、0pageerror；测试服务器已按所属PID关闭。
- 独立GPT Auditor /root/coverage29_audit：产品稳定差异审计PASS无confirmed finding；再核对最终文档、全部8个产品/测试文件摘要、真实数据/恢复与DS日志，**VERIFY PASS**。审计者独立执行只读恢复验证，未重跑全套浏览器/全量测试/生产。
- DS实际只读盘点，8953tokens，GPT采纳具体竞态/错误态/触控测试建议；没有新Provider或外发个人数据。Optimizer无瓶颈证据，跳过。
- 本轮未commit/push/tag/deploy；现有生产Sites v31保持。minute29准备成果保留，真实分钟、资产新闻源及异地保管等各自待办继续开放；本轮不是完整2.9封版。
- 没有生产/真机/远端CI新测，未测进程强杀时临时权限回收；最终库已明确关闭。下一次有界更新先复核唯一权威库/账本/冷却/权限，不自动调度。
