# 当前任务索引

## MR-PUBLISH-STATE25 — 发布执行中

用户明确授权“发布上传”。任务卡tasks/MR-PUBLISH-STATE25.md；上传现有已验收2.5与精修成果，补版本介绍，发布到既有Sites项目。以下未上传/未部署是开发阶段历史状态，以本发布任务最终记录为准。不改变受众、访问码或生产环境配置。

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
