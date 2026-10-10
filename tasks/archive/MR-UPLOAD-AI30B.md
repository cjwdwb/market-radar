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

状态 UPLOADED / CI_VERIFIED。使用既有github remote成功push，没有修改remote、凭据或仓库设置。

产品提交 `411ae1bd3084470b7dd5b9b1f5374547fc85b4cf`，tree `02faccf8f16cedc72ade605909275f933e6cc181`。本地/远端branch SHA和跟踪tree一致；main仍为上述7d2d30f。上传前独立GPT包装审计VERIFIED：19文件严格在允许范围，产品/测试与此前已审计版本一致，敏感模式扫描无命中，未上传被排除的数据或日志。

[草稿PR #6](https://github.com/cjwdwb/market-radar/pull/6)；该产品提交的[CI run38058677276](https://github.com/cjwdwb/market-radar/actions/runs/38058677276) / job114232286179 completed/success。Ubuntu24.04.5、Node22.15.0、npm10.9.2实际执行npm ci与npm test（含build/typecheck）；449PASS/0FAIL/0SKIP。此为本轮新远端证据，Windows/浏览器/原独立产品审计复用10月8日同内容结果，没有重复执行；既有chunk和工具警告不隐去。

上传后仅补本卡及任务/报告的上传记录，产品不变；最新PR head/checks以GitHub为准。没有合并main、标签、部署、模型API调用、密钥/访问设置变更或新增DS调用。真实模型合成质量、实际市场输入及生产仍待后续准入，不因上传归档而关闭MR-30B-REAL-PROVIDER-PILOT。
