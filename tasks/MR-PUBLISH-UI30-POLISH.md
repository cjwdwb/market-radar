# MR-PUBLISH-UI30-POLISH

## Planner — 2026-10-23

用户在 UI 收口后明确要求“上传部署”。本卡授权范围为已审计 UI 候选正常 GitHub 上传、PR/CI、合并及原 Sites 更新；不包含实时模型启用、秘密/访问设置、数据采集、迁移或新功能。

基线：GitHub main 重新 fetch 为 `57674a3a2dd81d77cbd79041bec743c8ac267765`；本地候选 `c4dd8bd9f200137c7d940ed7bed113e7adff2fa6`，产品 `7fdc9a9`，工作区干净。原 Sites get_site 本轮确认 active/public/v34，原 URL https://market-radar-rex.swt-aether.chatgpt.site 。部署源码仍以原 v34 记录 `d95b2ea35afc8d767ea65f3af4a7aabcdf34a497` 为核对点。

采用当前独立 ui30-polish 工作树；其他工作树不改。保留既有 D1/R2 null、应用访问码门禁及关闭的真实 Provider。已完成 UI 产品独立 VERIFY；沿用同产品的 693PASS/1Windows权限SKIP、build/typecheck/lint、五视口与工作流证据，不机械重跑。

## 允许路径与执行

仅新增本发布卡、ACTIVE/CURRENT_STATE/版本文档的必要记录与 ignored 发布产物；无计划产品改动。若 CI/打包证明有缺陷，先记录最小修复范围并针对性验证。

1. 审核候选提交范围与忽略文件，正常 push 原候选分支，创建 PR；Ubuntu/Node22.15 CI 必须通过后合并。
2. 官方 Sites source helper 打开已有 Site，使用同一已合并源码、既有构建与 manifest 打包；凭据仅内存/隐藏 stdin，不输出/写入文件。核对归档无私人资料/账本/Key/测试/采集脚本。
3. 独立 GPT Auditor 只读复核稳定 diff / 归档与环境边界；有 confirmed finding 修复后 VERIFY。
4. 对原 public audience 保存版本并部署；等待原生终态。低频匿名入口验证不能替代生产登录后、真机或真实 Provider 验收。
5. 记录 GitHub/CI/合并 SHA、Sites 版本/部署 ID/URL、包身份与检查；归档并同步 GitHub 文档，后续文档不触发第二次部署。

Optimizer：没有新产品计算改动或实测瓶颈，跳过。开发 DS 本发布无合适独立任务，不强制调用。真实产品模型请求目标为 0。

## 当前状态

PR #10 已合并 `cf8510f9fd2c78a4ec747fb0aeef7aa3d9118318`；新 CI39922261881/job120310052685，Ubuntu/Node22.15 build/typecheck/694项全部通过。发布执行中。

## 并行生产更新接续

首次正常 Sites push 被拒绝，未强推。重新打开来源并核对发现另一个用户任务 MR-HOMEPAGE-VISITOR 已在本轮过程中发布 v35：源码 `b647c43b76fca21cc437e5d6c9a9d376aabd4407`，deployment `appgdep_6adb156294208191825ee239b0918196` 原生 succeeded/env3。其 `/from-aether` 公开只读访客入口不能被 UI 发布回退。

执行最小整合：保留该来源提交的 worker/access-gate.ts、app/market-radar.tsx、components/cloud-monitor.tsx、tests/visitor-access.test.mjs 逐字不变；保留其任务与API记录。仅解决 ACTIVE/API 两个文档冲突，合并双方有效历史。新增范围为保留已上线功能，不自行发明新的访问策略或修改环境。其他工作树不动。

整合后重新构建/typecheck/相关lint、全量Node、五视口UI与访客只读路径；独立审计复核不回退v35、不启用真实模型。再次正常PR/CI后合并同源部署。本轮最终不能沿用初始“线上仅v34”的描述。

## 发布前发现 VISITOR-RSC-001 — 最小修复

整合候选 d7a424b（与25d34ea同tree）的实际生产构建浏览器，访客进入后3秒出现43次 `GET /.rsc` 401；页面初次HTML可用但Vinext后续root RSC被误拦。此前单元测试仅覆盖 `/?_rsc=test`，不能替代实际构建路径。报告位于独立浏览器工作树 `outputs/publish-ui30-final/visitor-before-rsc-fix/verification.json`，禁止将此轮记为PASS。

按本卡允许的已复现发布缺陷修复范围，新增允许路径 worker/access-gate.ts、tests/visitor-access.test.mjs、docs/API_CONTRACTS.md。仅为已有有效visitor会话允许精确root `/.rsc` 的GET/HEAD，服务于已允许主页的同一只读表示；不允许通配RSC、POST、未知页面、无会话、站主管理或模型消费。无环境/秘密/云访问策略变动。补相邻拒绝测试、受影响lint、重新构建/typecheck、实际访客复测与独立VERIFY，最终CI覆盖全量。旧归档包作废并重新打包。
