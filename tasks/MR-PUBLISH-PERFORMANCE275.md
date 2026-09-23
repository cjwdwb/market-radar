# MR-PUBLISH-PERFORMANCE275 — 发布准备

2026-09-23 CST。用户明确授权“上传然后部署吧”。发布2.75局部可靠性修复与性能基线，不宣称全面性能验收或完整2.7完成。

基线：codex/mr-performance-275，HEAD/GitHub main均为f037f2b24b499fbebd837dead465f92bde750800；Sites现场确认v25/public/owner。已有2.75工作区成果完整保留。

Goal：核对已审计候选，提交并正常推送GitHub main，既有Sites流程发布同一源码，记录原生成功结果与版本标签。

Allowed paths：既有components/radar/macro-timeline.tsx、tests/browser/radar.mjs、tests/performance/*.mjs、docs/PERFORMANCE_275.md、tasks/MR-PERFORMANCE-275.md；发布文档README.md、CHANGELOG.md、docs/VERSIONS.md、docs/CURRENT_STATE.md、tasks/ACTIVE.md及本卡/归档。不改产品功能、依赖、采集、数据库、密钥或访问策略。不上传outputs、数据库、原始数据、凭据。

Workflow：market-planner → market-builder发布整理 → 已有固定候选独立GPT审计证据核对 → Git正常推送 → Sites原生保存/发布/终态检查 → 发布记录归档。产品SHA256 ac96dca5c100fe24f42a14512e60c99e1b02b9b0af61774f1bb799603efc6d22 与候选一致。复用本轮前阶段269 Node、build/typecheck、受影响lint、89浏览器检查记录、26比较门槛及独立审计VERIFY；发布整理不冒称重新执行产品全套测试。DS调用0，无新Optimizer。

Acceptance：暂存仅允许文件、无敏感/原始产物；GitHub未意外推进；源提交与Sites保存源码一致，平台终态succeeded及原生URL；产品标签radar-v2.75与实际sites-vNN标记发布源码。后续文档提交另记，不重新部署。真机、后台、长时间性能及生产登录后未全面验证；原有2.7待办保持开放。
