# 当前任务

## MR-PUBLISH-VISUAL-245

状态：发布准备。用户于 2026-09-22 明确授权“发布上传吧”。

Goal：将已验收的 2.45 提交至 GitHub main 和 Sites 源码库，发布网站，标记产品与发布版本，更新介绍和发布记录。保留现有 public 受众及应用访问码。

Allowed paths：README.md、CHANGELOG.md、docs/{CURRENT_STATE,VERSIONS}.md、tasks/ACTIVE.md、tasks/archive/MR-PUBLISH-VISUAL-245.md；提交上一开发任务的已验收产品 diff。不新增产品功能，不改变依赖、数据库、环境变量、密钥或访问策略。

Validation：复用同产品 diff 的 83/83 tests、typecheck/build、48 项浏览器检查及独立审计；核验远端 fast-forward、提交/tag SHA 与 Sites 部署终态。发布不重复视觉 QA。任何网络或平台失败如实记录。

Workflow：沿用 Sites hosting 技能与仓库简化 PLAN/BUILD/VERIFY；先核对 source，再提交/上传、保存版本/部署、平台验证、归档。没有新产品性能瓶颈，跳过 Optimizer。

最近完成：MR-VISUAL-245，2026-09-22。Market Radar 2.45 视觉层级与动效偏好控制已实现；83/83 Node tests、typecheck、build、五视口 48 项浏览器检查通过，独立 GPT 审计未发现可证实的 BLOCKER/HIGH/MEDIUM。

分支 codex/mr-visual-245，基线 31954d3，成果尚未提交/推送/部署。生产仍为 Market Radar 2.4 / Sites v21，访问策略与密钥未修改。

任务、实际 DS 调用与审批限制、截图、测量和未覆盖范围见 tasks/archive/MR-VISUAL-245.md。后续发布须单独授权。
