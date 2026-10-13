# MR-UPLOAD-AI30B-DEEPSEEK — 2026-10-13

## Planner / authorization

用户明确“上传”。将已审计的DeepSeek适配、CLI/账本兼容、相关测试和如实记录的两次真实合成试点交接，上传至原`codex/mr-30b-real-provider-pilot`分支、草稿PR#6；不合并main、不部署、不启用生产或继续产品API调用。沿用market-planner/builder/auditor，不新增Provider/金融功能。

本轮实际核对：本地与远端分支均`62a01775558fb8afb7536f35148df14406e548d6`，main仍`7d2d30f6fe466a4e746ade2b3db231b2cb13b2d4`，PR#6 open/draft/未合并。工作树`worktrees/ai30b`原14个修改/未跟踪文件保留；无暂存改动。只操作该工作树及同一GitHub分支，不改其他任务。

## Allowed paths / acceptance

提交原14个文件：docs/{AI_PROVIDER_PILOT,API_CONTRACTS,CURRENT_STATE}.md，lib/ai/{real-config,openai-provider,deepseek-provider,responses-transport,real-service}.ts，lib/ai/product-budget.mjs，scripts/ai30b-pilot.mjs，tests/ai30b-{cli,deepseek}.test.mjs，tasks/{ACTIVE,MR-30B-REAL-PROVIDER-PILOT}.md；加本卡，完成后按惯例归档并更新上传索引/报告。

不上传outputs、原模型回复、SQLite/备份/初始化标记、密钥/环境文件、依赖或构建产物。产品9个代码/测试文件须与`outputs/ai30b/deepseek-20261013/execution-handoff.json`哈希相同；暂存白名单、敏感模式与Git规范化内容由独立GPT只读复核。

复用本地73专项/typecheck/lint和独立最终VERIFY；10月12日全量/build是旧证据，不冒称当前重跑。上传触发原Ubuntu/Node22.15 CI（npm ci→npm test，已含build/typecheck/全量Node），等待真实head结果；若CI失败，仅修明确候选问题并针对复核。无瓶颈不进入Optimizer，无新DS调用。

验收：原分支正常非强推上传；草稿PR更新最终scope和A1 PASS/A2 FAIL/9类NOT RUN、2次保守占用$0.0053184非账单；远端提交/tree与本地一致，CI实际结果记录。质量FAIL不会因上传/CI成功改变，真实市场准入与生产保持关闭。

## Execution

待上传前暂存审查、push、PR说明更新与CI。当前生产仍Sitesv32；本次上传授权不扩展为发布。
