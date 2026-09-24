# MR-PRE28-BACKLOG-CLEANUP

2026-09-24 CST。Planner范围冻结：有限维护，不开发2.8，不取消完整2.7。不push/merge发布分支/tag/deploy，不读写真实数据库或启用采集。

基线：e89d3ec6e723ac52211e22d2ee571b0f414a3e3c，开始工作区/暂存/未跟踪均空；原分支codex/mr-performance-275。协调分支codex/mr-pre28-backlog-cleanup；DS独立worktree ../market-radar-pre28-ds，codex/mr-pre28-ds-worker，同基线。生产记录2.75/Sites v26，源码0a863666c5b04c376738edee7443dafa223a3e50；本轮没有线上交互复验。

## 有限遗留清单（冻结）

| 类别/原任务 | 证据与当前状态 | 影响/已修复？ | 风险/负责人/允许路径 | 验收与阻塞 |
| --- | --- | --- | --- | --- |
| A / MR-WATCHLIST-INFORMATION-HISTORY-27 lint | app/market-radar.tsx:4，Cloud仅import，新测unused-vars | 无效导入；未修 | LOW，DS初版；只删Cloud specifier，读该行及rg引用 | 精确单token差异；lint由3errors/6warnings降至3/5，其余逐项相同；GPT typecheck/build |
| B / MR-PUBLISH-PERFORMANCE275、MR-WATCHLIST-INFORMATION-HISTORY-27、开发Provider记录 | docs/CURRENT_STATE.md:7起、docs/HISTORY_FOUNDATION.md:76/170、docs/DEVELOPMENT_PROVIDERS.md末尾 | 历史“当前生产/没有CLI采集”可能误读；有总历史说明但局部未标时期 | LOW，DS文档；仅三文件局部时期注记和原任务链接；ACTIVE协调者 | 不删原证据/限制；路径存在；当前与历史可区分；命令只静态核对不操作DB |
| B→专项Deferred / 同一lint | 当前3errors及其余5warnings：set-state-in-effect、exhaustive-deps、img | 未修；不能把lint提示直接等同产品缺陷 | 非低风险Hook/生命周期/image改动，GPT判断本轮不实施 | 保留rule/line清单，未来复现与语义设计后修；不disable、不改依赖 |
| C / MR-PERFORMANCE-275 | docs/PERFORMANCE_275.md交付限制 | 真机/高刷新、真实后台/小时级、部分profiling未验证 | 无本轮产品影响，不派DS“修复” | 原NOT RUN保留，需设备/环境与专项测量；旧QA不重开Gate |
| C / MR-WATCHLIST-INFORMATION-HISTORY-27 | docs/HISTORY_FOUNDATION.md:164起矩阵 | owner真实集合、获准价格源、长期异地保管未完成 | 条件阻塞，owner/来源/GPT | 用户真实导出与授权、来源权利/费用、存储决定；不猜配置 |
| D / MR-WATCHLIST-INFORMATION-HISTORY-27及2.8路线 | 原任务卡、HISTORY_FOUNDATION研究协议 | 完整信息覆盖、九月价格回补/查询、研究与后续校准仍开放 | 后续功能，本轮禁止实现 | 保留四主线和原入口；来源/时间/研究高风险契约另审 |

已关闭导入失败丢数据属于2.75成果，本轮不重复计算。API/金融/刷新/权限/数据架构零改动。无新依赖。无测量瓶颈，不进入Optimizer。

## 分工与验证

使用既有market-planner/builder/auditor；GPT规划/接受/集成；DS先单文件导入清理作为代码写入试验，成功后串行文档。用户本指令允许所需普通源码/文档最小外发，禁止私人数据/密钥/完整聊天。配置核对仅非敏感字段：deepseek-flash/deepseek，read-only默认，写任务显式workspace-write；CLI现为0.155.0-alpha.16.3。环境仅确认key存在，不打印值。Worker启动身份/实际能力以本轮结果为准。

DS每卡一轮、最多一次GPT指定修正；失败停止，不改Provider/安全边界。可用时真正交DS实施，GPT不重写正确成果。只发送指定卡与必要路径。DS不得写ACTIVE/提交/合并/发布。协调者检查完整diff/暂存/未跟踪及生成产物。最终独立GPT只读审计稳定候选；未审则PENDING_GPT_REVIEW。

初始新测：node node_modules/eslint/bin/eslint.js app/market-radar.tsx，exit1，3errors/6warnings。Cloud无引用、lucide-react包sideEffects=false且其余导入保留，不改变模块求值。精确删除后无需新增镜像测试。运行同命令对比诊断，node scripts/typecheck.mjs及node node_modules/vinext/dist/cli.js build（按实际生成类型次序）；纯文档核对链接/事实/diff。无运行代码变化，不重复269Node/89浏览器或性能实验；历史仅参考docs/PERFORMANCE_275.md，不记为本轮通过。

协调者允许写：本卡/归档、ACTIVE及DS已批准成果app/market-radar.tsx、上述三文档；本地证据仅ignored outputs/pre28。发布记录/历史原档不重写。执行新发现仅入待办，不扩大冻结范围。

## 稳定候选与本轮新测（待独立审计）

DS-01：初次启动身份deepseek-flash/deepseek、approval never、workspace-write，仅独立workdir/tmp可写；工具profile既有web/MCP关闭。本轮CLI0.155.0-alpha.16.3。模型目录解析失败/fallback metadata和PowerShell snapshot警告仍存在，不是改Provider或扩大权限的理由。首次Worker三次apply_patch参数解析失败（均未写入），违反首次失败停止约定；协调者Ctrl-C中止，exit1，记录能力限制。无审批拒绝、无通道绕过。GPT明确批准唯一同范围修正，用一次guarded native PowerShell编辑；第二次Worker exit0，精确删除Cloud。GPT通过git blob与Worker文件逐字对比ACCEPT并原样接收。此结果不认证无人监督工具能力。

DS-02：同一工作树串行三份文档，initial exit0；GPT发现新level-2标题会把更早2.6等历史误归2.7，REQUEST FIX一次，Worker改成只限定下面两段的普通段落，exit0。GPT核对完整diff后ACCEPT，未按风格重写。文档仅增历史时期/原档入口；未改旧BLOCKED/NOT RUN、覆盖或测试数字。Worker读取整文件用于编码检测/受限替换，但模型输出限定为批准片段/非敏感元数据；文档经协调者预筛无敏感信息。没有读取私人配置/数据或向DS提供密钥内容。

实际DS任务2个，CLI执行4次（两次initial、两次明确同范围修正）；初次代码任务失败并中止，其余3次exit0，两项最终接受；审批拒绝0、待GPT接收0。报告的tokens used：DS-01修正2532、DS-02初版15860、DS-02修正2109；初次中止无统计，总token/费用unavailable，不推算节省率。任务输入保留在ignored outputs/pre28/ds01-task.txt、ds01-fix-task.txt、ds02-task.txt、ds02-fix-task.txt；工具回执见本任务会话，不伪造逐请求费用。

所有Worker变更只涉及app/market-radar.tsx及3份文档；暂存/未跟踪均空，无生成产物。协调者接收后工作区另含ACTIVE/本卡，生产文件仍只有1个import token。DS未运行产品lint/build，未伪称通过；本地runner由GPT协调者实际执行：

- `node node_modules/eslint/bin/eslint.js app/market-radar.tsx --format json --output-file outputs/pre28/lint-before.json`：exit1，3errors/6warnings。after同命令输出lint-after.json：exit1，3errors/5warnings。对比断言PASS：只移除Cloud unused-vars，其他8条rule/line/column/message/severity完全相同；证据lint-comparison.json。未宣称lint-clean。
- `node node_modules/vinext/dist/cli.js build`：exit0，outputs/pre28/build.txt；原大chunk警告保留。
- `node scripts/typecheck.mjs`：exit0，outputs/pre28/typecheck.txt；按生成类型要求在build之后执行。
- 主客户端market-radar-BrkD5LTZ.js与2.75本地候选manifest比较：772454 bytes、SHA256 4130bd34c77a22fc531c88a6f040238d33f7f66033356bf6a3cdd31030f7f826完全一致（client-comparison.json）。这是构建产物相等证据，不是新FPS测量，也非整站所有产物证明。
- DS与协调者diff/path检查通过；文档命令仅与scripts/fed-history.mjs静态核对，本轮不执行status/backup/restore/collect，不碰真实DB。
- 全量Node、浏览器、性能、真机：NOT RUN。唯一产品差异是未用导入，生成主bundle完全相同，文档不影响运行；不为流程重复全套。2.75的269Node/89浏览器与性能限制仅历史参考，来源docs/PERFORMANCE_275.md及其源码0a86366，不计本轮新测试。npm test包装未执行。

尚存lint：set-state-in-effect在117/236/266；exhaustive-deps在135/238（两条）/318；no-img-element在355。需要专项语义/生命周期审查，本轮未实施。2.75导入修复未改；未新增测试或弱化断言。

候选状态PENDING_GPT_REVIEW。生产仍按发布记录2.75/Sites v26；本轮未提交、未合并发布分支、未push/tag/deploy。完整2.7仍开放，后续2.8路线未取消。

## 最终独立审计与收口

独立GPT Auditor pre28_final_audit 对e89d3ec稳定diff（5 tracked+1 task，暂存空）完成VERIFY PASS，无未解决BLOCKER/HIGH/MEDIUM/LOW。Auditor亲自执行只读源码精确diff、lint JSON等价、主bundle字节/hash、路径与diff-check；审阅而未重跑协调者build/typecheck。未验浏览器/真机/生产/全量Node/长期性能，也未读私人配置或真实数据。DS首轮停止约定违反仍保留，不认证无人监督能力。

关闭：A未用Cloud导入（DS实施，GPT精确diff+lint/typecheck/build，独立审计）；B三份文档历史身份整理（DS初版/一次修正、GPT接受、独立审计）。原2.75导入缺陷不计本轮成果。协调者核对8个任务/脚本入口，未发现本轮新增失效路径；不声称全仓链接清零。

未关闭：剩余3errors/5warnings需要GPT后续专项判断；MR-PERFORMANCE-275真机/后台/长期实验限制；MR-WATCHLIST-INFORMATION-HISTORY-27真实owner集合、获准历史源、长期保管及价格回补/完整信息/研究；完整2.8暂缓但未取消。旧QA不重启Gate也不改变状态。

2.8恢复前最少决定：取得用户明确导出/批准的真实资产集合；按目标粒度确定合法历史来源及适用费用范围；确定长期保存目标与回补/持续采集权限；GPT冻结历史可知性/回放/研究目标契约。条件来源为原2.7卡及HISTORY_FOUNDATION，不意味着本轮获得授权。现有宏观元数据链路和本地恢复已有历史证据，未重新称为全部缺失或本轮新测。

有限清理完成，候选已通过独立审核，保留未提交在codex/mr-pre28-backlog-cleanup及DS独立工作树供复查。归档仅关闭本清理卡，不关闭原2.7/2.75待办。原PENDING_GPT_REVIEW为上阶段状态，已由上述审计解除。生产按既有记录仍2.75/Sites v26；本轮未push/merge发布分支/tag/deploy，未新增产品版本，不安排后台继续运行。归档/索引收口为协调者文档更新。
