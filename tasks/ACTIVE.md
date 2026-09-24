# 当前任务索引

## MR-PUBLISH-PRE28-CLEANUP — 上传部署中

用户另行授权发布已审计的有限清理，卡片tasks/MR-PUBLISH-PRE28-CLEANUP.md。不创建新产品版本；下列未发布描述为清理开发阶段事实，完整2.7/2.8待办保留。

## MR-PRE28-BACKLOG-CLEANUP — 有限清理完成，已归档

归档tasks/archive/MR-PRE28-BACKLOG-CLEANUP.md；基线e89d3ec，独立本地候选未提交/未发布。DS实际完成未用Cloud导入及三份文档历史说明，两任务/四次CLI（含各一次指定修正）；首轮工具失败与停止约定违反如实保留。新测lint3errors/5warnings（其余诊断不变）、build/typecheck、路径/diff检查通过；独立GPT审计VERIFY PASS，无未解决finding。剩余Hook/image lint、设备/数据条件及完整2.7/2.8保留，不冒称lint-clean或提帧。生产仍2.75/Sites v26。

## MR-PUBLISH-PERFORMANCE275 — 发布成功，已归档

当前生产：Market Radar 2.75 / Sites v26，2026-09-23 CST发布，源码`0a863666c5b04c376738edee7443dafa223a3e50`，平台succeeded、环境revision3。产品标签radar-v2.75与发布标签sites-v26对应同一源码。归档导入失败保留原数据与查询；包含本地性能验证工具和报告，没有宣称帧率提速。完整2.7与真机/后台/长期性能待办保留。发布记录见tasks/archive/MR-PUBLISH-PERFORMANCE275.md；后续文档提交不重新部署。 下列开发阶段未发布描述保留原时点事实。

## MR-PERFORMANCE-275 — 本地测量与可靠性修复已验证，性能验收限制保留

独立分支codex/mr-performance-275，基线f037f2b；生产仍2.7 Foundation/Sites v25。真实时间production-build基线/候选各十轮，26项比较门槛通过；已修复失败导入清空旧归档。269Node、build/typecheck/受影响lint、89项浏览器检查记录通过（含五视口）。独立GPT审计两项测量finding修复并VERIFY；无产品严重finding。没有可宣称的帧率提速，真机/真实后台等限制保留，不声称完整2.75性能验收。不改刷新/动效/金融语义，未提交/上传/发布。任务卡tasks/MR-PERFORMANCE-275.md，证据docs/PERFORMANCE_275.md；完整2.7任务入口和未完项保留。

## MR-PUBLISH-FOUNDATION27 — 发布成功，已归档

用户本轮授权上传部署；源码`5d759a19946310deb1afefc12db5a490f4b12af0`已上传GitHub main并发布Sites v25，平台succeeded/env revision3。2.7 Foundation阶段成果，radar-v2.7-foundation/sites-v25标记同一源码。记录tasks/archive/MR-PUBLISH-FOUNDATION27.md；完整2.7下列任务仍开放。未启用云采集/迁移，未改访问策略/密钥。原未部署记录属于开发阶段历史，发布说明随后单独文档提交。

## MR-WATCHLIST-INFORMATION-HISTORY-27 — B0/C0 + B1/C1 本地交付，完整2.7仍开放

2026-09-23 CST：真实美联储宏观RSS→SQLite→版本查询→新空库恢复→Radar显式本地文件导入已验证。2条九月公告，累计4请求/38580bytes（含2次解析失败），重跑0新增；不是全月完整/个股资讯/价格回补。固定来源、共享硬配额、schema2、恢复禁采集；无新HTTPAPI/云绑定/生产权限变更。

本轮269Node、最终44存储专项、build/typecheck/受影响lint通过；9宏观+14自选+10旧2.6浏览器检查通过，五视口为桌面模拟。主app既有lint3error/6warning保留。独立GPT A/B finding已修并复核，稳定候选B/C1独立VERIFY PASS，无未解决confirmed finding。DS实际0。任务卡 tasks/MR-WATCHLIST-INFORMATION-HISTORY-27.md；契约/证据/运行手册 docs/HISTORY_FOUNDATION.md。

实际owner清单、价格历史许可/来源、长期保管与研究D仍待补；四条主线未删减，不宣称完整2.7完成。开发基线00d7ef4；已按后续授权将B0/C0/B1/C1阶段成果提交为5d759a1、上传并发布2.7 Foundation/Sites v25，未开启云采集。分支codex/mr-watchlist-information-history-27；旧QA不重开Gate。

## MR-PUBLISH-STATE26 — 发布成功，已归档

用户明确授权“上传部署吧”；报告tasks/archive/MR-PUBLISH-STATE26.md。2.6+精修源码8641d81已上传GitHub并发布Sites v24，平台succeeded、环境revision3。radar-v2.6/sites-v24标记同一源码；说明文档随后单独提交，不重新部署。网址/访问设置保持不变，以下未上传/未部署为此前开发历史。

## MR-STATE26-REFINE — 本地精修完成，已归档

报告tasks/archive/MR-STATE26-REFINE.md；保留2.6未提交成果，分支codex/mr-state26-refine。历史比较按项展开、详情末尾返回、缺失维度标签完成；390px默认比较高度2368.5→475.75px，保留全部原数字证据。本轮新build/typecheck、6专项/10状态回归/9精修回归及320截图补证通过。独立审计1 LOW截图证据问题修复并VERIFY，无产品finding。领域/数据请求未改；本轮未提交/上传/部署。

## MR-STATE-INTELLIGENCE-26 — 约定本地范围验证完成，已归档

报告tasks/archive/MR-STATE-INTELLIGENCE-26.md，契约docs/STATE_INTELLIGENCE.md。基线09338aa，分支codex/mr-state-intelligence-26，成果保留为本地未提交diff。当前资产Short90m/Medium180m、Short连续Relative、Alignment及历史窗口Transition均完成。218 Node、build/typecheck、五视口72综合+9精修通过，2.6额外10项定点复测通过；独立领域/集成审计无confirmed findings。零新增symbol/请求/timer；真机与生产2.6路径NOT RUN。现有生产仍2.5/Sites v23，本轮不上传/部署，不恢复旧QA Gate。

## MR-PUBLISH-STATE25 — 发布成功，已归档

用户明确授权“发布上传”。已将2.5及精修源码31a11d2上传GitHub，并发布为Sites v23，平台succeeded、环境revision3。产品标签radar-v2.5、发布标签sites-v23对应同一源码；报告tasks/archive/MR-PUBLISH-STATE25.md。已补README/CHANGELOG/版本索引；以下未上传/未部署是开发阶段历史状态。受众、访问码及生产环境配置保持不变。

## MR-STATE25-REFINE — 约定本地范围验证完成，已归档

报告 tasks/archive/MR-STATE25-REFINE.md。用户要求主动检查优化，并明确旧未验证项本轮不用跟进。已保留2.5未提交成果，分支codex/mr-state25-refine；完成价格刻度、图表尺寸、详情层级及首屏加载修复。最终99 Node、build/typecheck及9项专项通过；62项综合回归在最后刻度LOW修复前通过。独立GPT审计1 LOW已修复并VERIFY，无未解决confirmed findings。本地成果未上传/发布。

## MR-245-POST-RELEASE-QA — 历史缺口保留，本轮不阻塞

整体结论仍为证据不足。生产2.45 / Sites v22，源码6804b41。
最新用户决定：旧未验证项本轮不用跟进，不再作为本轮本地推进Gate；没有把BLOCKED改为PASS，也不绕过认证。
QA-A生产登录后路径：BLOCKED；上轮已重开独立Edge到门禁，用户说明当前无法使用Edge后停止，未取得授权会话、不绕过门禁。本轮按用户决定不再跟进。
QA-B iPhone第5步：PASS（2026-09-22用户明确确认已实测四项正常；iPhone16 Pro/iOS26.2、现有正式2.45）。其余五步历史用户PASS保留；不冒称代理真机实测或未来2.5验收。
原报告 tasks/archive/MR-245-POST-RELEASE-QA.md 保留历史结论；本轮补证更新及责任/下一步见 tasks/archive/MR-MARKET-STATE-25.md。

## MR-MARKET-STATE-25 — 约定本地范围验证完成，已归档

基线：8a79166512d26d958c5ad380b2e3977cb2265d1f，本地/GitHub起点已核验；原实施分支codex/mr-market-state-25-builder，成果已保留到上述精修分支。本任务开始时无遗留用户改动，本任务diff未提交。
契约与范围见 tasks/archive/MR-MARKET-STATE-25.md：方向结构+RMS波动对比，连续相对表现Deferred，零新增请求/timer。
Gate：用户明确答复“允许带 QA-A 缺口进行上述隔离实现”。进入独立分支codex/mr-market-state-25-builder，仅本地实现/测试/审计。QA-A仍BLOCKED，不改成PASS，不授权merge/push/tag/deploy。
本轮禁止push/merge/tag/deploy/改密钥；现有2.45已上线，本轮2.5未部署。历史测试不是本轮新测。
本轮新测98 Node /62浏览器（14 State+48原矩阵）、build/typecheck通过；GPT独立审计两项LOW已修复复核，最终报告定点VERIFY通过。2.5新增UI真机NOT RUN。
