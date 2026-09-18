# MR-PRE24-CORRECTNESS

状态：完成本地修复、验证与 GPT 审计。2026-09-17。用户要求检查现版本不足，为 2.4 开发准备稳定基线；未授权发布，本轮未推送或部署。

## Scope and baseline

基线 db35e5c。保留现有 Provider 文档/任务归档与 RADAR 发布描述未提交变更，不将其归入本轮产品修复。工作树仍在 codex/mr-dev-deepseek-provider，本次文件级 diff 与 Provider 成果区分记录，未擅自提交混合改动。

允许路径：lib/radar/engine.ts（仅 evidence）、lib/radar/workflow.ts、components/radar/radar-feed.tsx、tests/radar-engine.test.mjs、tests/ui-components.test.mjs、任务记录。无 API、依赖、认证、市场源、信号阈值、请求策略或 CSS 改动。

## Findings and fixes

- HIGH 信息准确性：breakout/breakdown 将区间价格放入百分比 evidence 的 baseline，UI 附加 %。修复为独立带报价币种的价格项，百分比项只保留涨跌幅与百分比阈值。
- MEDIUM 证据量纲：volume spike 的 baseline 数量附于倍数项，混淆绝对量与倍数。改为独立平均基础币成交量项，倍数和阈值仍为 ×。
- MEDIUM 精度：证据绝对值统一两位小数，使极小价格归零。绝对证据采用最多 10 位有效数字；主证据和组合证据复用格式，百分比/倍数样式不变。
- MEDIUM 覆盖统计：summary 丢弃尚未生成 coverage 的自选资产。按去重后的自选总量计数，缺失记录计 waiting，辅助 benchmark 不加入总数。
- MEDIUM 空状态：当前资产或市场不可扫描，但其他资产可扫描时，错误显示暂无异常。空状态改用当前筛选/资产的 eligible 判断，保留离线/暂停优先级；资产上下文中不显示旧 My Radar 筛选的添加按钮。

## Validation

- Radar engine 27/27，intelligence 5/5，UI components 6/6；最终全量 Node suite 74/74。
- node scripts/typecheck.mjs 通过；直接 Vinext build 通过。
- tests/browser/radar.mjs，RADAR_INTEGRATION=1：30 checks、0 page errors；1440、768、390、320、844×390 五视口均无横向溢出。
- 浏览器覆盖 Classic↔Radar、资产上下文、自选增删、价格提醒、图表、键盘、实时 reduced-motion、空/旧/失败/部分/慢数据、存储失败与开场。新增缺失覆盖/量纲/极小数/局部空状态边界通过 Node 与 SSR 测试验证。
- 本轮浏览器报告 outputs/radar/verification.json，2026-09-17 17:10:20 生成；截图 integration-*.png，均位于忽略目录。本轮实际查看桌面和 320 px Radar 截图。
- 主 chunk：2.3 已记录 730,018 bytes → 本次 730,363 bytes，+345 bytes（约 0.05%）；500 KB 历史警告保留。无新增请求、timer 或依赖，无已证性能瓶颈，跳过 Optimizer。不宣称 FPS 提升。

## GPT audit and verify

按 market-auditor 工作流检查最终产品 diff、Engine 调用、Intelligence 消费和两级 evidence 渲染，确认检测条件/强度/排名/生命周期语义未改。上述 findings 均修复，相关回归及最终浏览器报告通过；未发现本轮剩余 BLOCKER/HIGH。此为主 GPT 角色审计，未启动独立审计 agent。

限制：没有生产登录后复测、真实设备 Safari 或性能帧率测量；UI 浏览器数据为可复现测试 fixture。未开展全仓安全审计。原生长上下文、持久历史与 2.4 新功能不属于本轮。

## Handoff to 2.4

先明确 2.4 的最终 scope，再建独立任务卡。当前修复与之前 Provider 文档都保留本地未提交；如需上传，应按任务分组提交。当前正式站仍为 2.3 / Sites v20，本轮 NOT DEPLOYED。
