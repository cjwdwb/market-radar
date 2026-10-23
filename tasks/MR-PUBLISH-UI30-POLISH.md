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

发布执行中；尚未将候选上传或部署，不预填通过。
