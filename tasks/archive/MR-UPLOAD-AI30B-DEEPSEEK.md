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

状态：UPLOADED / CI_VERIFIED。产品提交`36f3f0a4b8a4b337d0619cb6a3447ff42eeb6aff`，Git tree `3f1e324324d086c4bf3b56b893b30feb81bebcff`；本地HEAD、远端原分支及跟踪tree一致。正常push，无force；main仍7d2d30f，无合并。

上传前独立GPT包装VERIFIED PASS：index正好15个白名单，9个产品/测试文件与执行交接hash一致，无未暂存或非忽略额外文件；敏感扫描只命中测试mock值，没有真实秘密/数据库/outputs进入index。暂存diff SHA256 `58c69780810b62d0bb6b0573bc3fe8f32d4479dc8c7f3723c1ffee8609bd0779`，格式检查通过。未重复产品审计或付费调用。

原[草稿PR#6](https://github.com/cjwdwb/market-radar/pull/6)标题/说明已按DeepSeek实际scope更新，明确A1 PASS/A2 FAIL/9类NOT RUN。产品提交的[CI38349103530](https://github.com/cjwdwb/market-radar/actions/runs/38349103530)及job115137189295 completed/success；Ubuntu24.04.5、Node22.15.0、npm10.9.2实际npm ci→npm test（build/typecheck/Node），491PASS/0FAIL/0SKIP。本轮新远端证据，不以旧488/449结果代替。既有>500kB chunk与Actions旧Node运行时提示保留，不扩为重构。

上传后仅补本归档卡和任务索引/报告的上传事实，产品代码不变；最新文档head/checks见PR。CI成功不代表模型质量通过。现有Sitesv32不变，没有部署、标签、模型消费、密钥或生产配置变更；主试点质量Gate继续开放。
