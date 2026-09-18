# 当前任务

## MR-PUBLISH-ASSET-INTELLIGENCE

状态：发布准备。2026-09-18；用户明确授权上传并发布 2.4。

Goal：将已验收的 2.4 与此前 PRE24 正确性修复、Provider 文档上传 GitHub，发布到现有 Sites，补齐版本标签与介绍。Non-goals：新增产品功能、修改访问配置/凭据/数据库、移动旧标签或强制推送。

Baseline：HEAD db35e5c，GitHub main 远端核对同 SHA；Sites 当前 v20 / Radar 2.3。保留并显式归属全部已完成本地改动。

Allowed paths：README.md、CHANGELOG.md、docs/VERSIONS.md、docs/CURRENT_STATE.md、docs/RADAR.md、docs/ASSET_INTELLIGENCE.md 与发布任务记录；已验收产品 diff 只提交不改写。无 API / 请求 / 架构变化。

Acceptance：精确源码提交普通推送 GitHub/Sites；源版本保存、生产部署终态 succeeded；新 radar-v2.4 和实际 sites-vNN 标签对应部署源码；发布记录与远端引用核验。复用 80/80 tests、typecheck/build、36 项浏览器和独立审计；仅发布文档修改不重复产品 suite。远程构建如需要由平台执行；无法成功必须如实记录。

最近完成：MR-ASSET-INTELLIGENCE — Market Radar 2.4 Asset Intelligence Foundation。PLAN → BUILD → tests → 独立 AUDIT → 最终 VERIFY 已完成；未出现需要产品修复的 finding，无明确瓶颈，跳过 Optimizer。

结果：selected asset 的统一纯函数 Context 已供 Classic/Radar 共用；全量 80/80 tests、typecheck、build、五视口 36 项浏览器检查通过。契约见 docs/ASSET_INTELLIGENCE.md，完整任务/验证/限制见 tasks/archive/MR-ASSET-INTELLIGENCE.md。

产品开发阶段分支 codex/mr-asset-intelligence，HEAD db35e5c；此前未 push、未打标签、未部署。此处为开发交接状态，发布结果由本任务补充。
