# 决策记录
仅记录影响后续工作的决定，不把推测写成历史决策。

## 2026-09-15：Classic 与 Radar 共用工作台
- 继续单一状态所有者与原生 hash 导航；根路径 hydration 后应用默认体验，不引入第二套 router/state/request 系统。
- 现有 crypto 15m 历史与股票 5m Quote.points 统一进入纯 Engine；未来可搬到 Worker，但本轮不部署云端 Engine。
- 数据不足则等待；加密5m、股票量能和相对强弱延期。时间、来源、币种与完整连续bar是检测前提。
- 会话记录有限；方向独立fingerprint、恢复滞回与冷却控制噪声。独立审计后修复跨日去重与方向反转两项P2。

## 2026-09-14：采用项目内轻量角色工作流
- 共享规则仅在 AGENTS.md；事实在 docs；任务边界在 tasks/ACTIVE.md；四个 Skill 只写角色差异。
- 使用 .agents/skills/market-{planner,builder,optimizer,auditor}/SKILL.md，限本仓库发现。
- 不添加自动调度服务、不改全局模型/配置、不强制所有阶段或并发；以任务独立性决定。
- Auditor 默认报告不修复；修复由 Builder 接手，完成后针对新 diff 复核。
- 依据：减少重复上下文、无收益优化、多人同文件冲突与全量检查。

## 现有实现事实（不是本次新增设计）
- 报价与历史分离、失败退避及数组复用：见 project-references.md 和 lib/refresh-policy.ts。
- 浏览器提醒与独立云端 Worker 并存；实现位置见 ARCHITECTURE.md。
- 不沿用旧会话中 WebSocket/provider 目录示例作为本项目事实。
