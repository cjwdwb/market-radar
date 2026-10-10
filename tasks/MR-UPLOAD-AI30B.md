# MR-UPLOAD-AI30B — 2026-10-10

## Planner / authorization

用户本轮明确“上传吧”。将已审计的3.0B离线Provider候选上传至 `cjwdwb/market-radar` 独立分支 `codex/mr-30b-real-provider-pilot`，创建草稿PR并完成现有Ubuntu/Node22.15 CI。此为上传授权，不合并main、不部署Sites、不启用模型或修改凭据。

实际工作树 `worktrees/ai30b`；本地与本轮重新核对的GitHub main均为 `7d2d30f6fe466a4e746ade2b3db231b2cb13b2d4`。未找到该分支既有PR。2026-10-08交接18文件SHA全部匹配，无额外产品变更；原minute29/minute-gate29成果不写入。

## Allowed paths / acceptance

仅提交 `outputs/ai30b/handoff-manifest.json` 所列18个已审计文件，加本上传卡与ACTIVE/CURRENT_STATE/AI_PROVIDER_PILOT的上传状态记录。允许将本卡归档至tasks/archive；不改变Provider、行情、算法、刷新、权限或数据库语义。若CI出现可复现失败，只修对应上传候选问题并针对复核。

不得上传outputs、DS原始日志、密钥/环境文件、SQLite账本/初始化标记、原始行情、依赖或构建产物。暂存范围及差异由独立GPT只读复核；远端tree与本地Git规范化tree核对一致。

已有离线证据：31专项PASS；全量449项/448PASS/1既有Windows权限skip；build/typecheck/受影响lint、五视口8组PASS；独立GPT两项P2及P3修复VERIFY、最终18文件证据VERIFY PASS。此次不将这些写作重新运行。真实Luna调用0、合成质量NOT RUN，真实行情准入BLOCKED、生产仍Sitesv32关闭真实模型。

上传验收：分支/草稿PR存在，远端内容与本地候选一致，现有CI在实际head成功，记录提交/PR/run及未验证范围。无新瓶颈，跳过Optimizer；无新增DS外发任务。

## Execution

状态 PREPARED；提交/远端PR/CI结果待实际执行后登记。不会把上传完成写成真实模型启用或整个3.0B完成。
