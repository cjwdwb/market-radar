# MR-UPLOAD-AI30A — 2026-10-07

## Planner / authorization

用户本轮明确“上传吧”。目标：将已经独立审计通过的3.0A Foundation上传到 `cjwdwb/market-radar` 的独立 `codex/mr-30-ai-foundation` 分支，建立PR并验证现有Ubuntu/Node22.15 CI。只上传，不合并main、不打标签、不部署Sites、不启用真实模型或修改配置。

main/本地基线 `de6eb05a0f6ba716c3c75f6e5db788c47feecb71`，本轮GitHub连接器重新核对一致；没有既有开放PR。原生产Sitesv32不动。根目录仅为工作树容器，实际上传对象为 `worktrees/ai30a`；minute29/minute-gate29的未提交成果保留。

## Allowed paths / verification

已审计候选29文件按 `outputs/ai30a/final-candidate.json` 固定，只允许提交原内容，不扩产品范围。允许本卡、ACTIVE/CURRENT_STATE/AI_FOUNDATION增加上传结果及修正归档链接。构建产物、outputs、依赖、.dev.vars、密钥、SQLite、原始数据和DS日志不上传。GitHub按既有CI处理；没有产品变更不重复本地全量测试，出现远端明确失败才修复对应原因并复测。

本地既有候选证据：32定向PASS；全量418项/417PASS/1既有Windows权限skip；build/typecheck、新代码lint、五视口6组、独立GPT最终VERIFY PASS。全文件主组件3个既有lint错误及5警告保留，不冒称全文件检查通过。真实模型、真机、生产登录尚未测试。

上传验收：远端tree与本地Git规范化tree一致；PR只包含批准改动；CI针对实际head通过；记录commit/PR/run与阶段差别。Optimizer无新瓶颈，不进入。上传阶段仅文档记录，不新增DS任务/外发。

## Execution

状态 UPLOADED / CI_VERIFIED。本地origin指向现有Git代理并缺少认证，未修改remote或凭据；使用已连接GitHub的原生提交/分支/PR工具完成授权范围。此为认证不可用的正常替代，不涉及审批拒绝。

产品提交 `15535d600b9a9eadc1f80c57698c98c5dd7c8857`，远端tree与本地规范化index完全一致：`d1e29458dacf8b163c0a740d78f705143b29a6c2`，30个批准文件。通过只读公开Git fetch取得同一对象，本地独立分支快进至同SHA，未reset/改remote/混入原工作树。

[PR #5](https://github.com/cjwdwb/market-radar/pull/5)，base仍de6eb05a；既有[CI run37632197422](https://github.com/cjwdwb/market-radar/actions/runs/37632197422)/job112829052408成功。Ubuntu24.04/Node22.15执行npm ci → npm test（包含build/typecheck）418PASS/0FAIL/0SKIP；不是Windows历史证据。PR测试合成merge ref，不是已合并main；既有chunk/工具deprecated警告保留。

原两分钟工作树26文件指纹全部一致。没有产品修复、模型调用、数据采集、push main、merge、tag、deploy或配置变更。后续仅补本次上传文档，产品内容不变；最终PR head/checks以GitHub记录为准。新代码本地测试不重复执行；本轮新增证据为远端CI。原开发审计及限制见[报告](../../docs/AI_FOUNDATION.md)。
