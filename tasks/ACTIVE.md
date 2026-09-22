# 当前任务索引

## MR-PUBLISH-STATE26 — 上传与发布中

用户明确授权“上传部署吧”；任务tasks/MR-PUBLISH-STATE26.md。提交2.6+精修并发布原Sites项目，保留网址/访问设置。核对最终候选hash及远端，补README/CHANGELOG/版本标签，不新增产品功能。

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
