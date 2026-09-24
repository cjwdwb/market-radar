# MR-PUBLISH-PRE28-CLEANUP — 发布准备

2026-09-24 CST。用户在有限清理完成后明确授权“上传部署”。沿用market-planner / builder与Sites hosting流程；只发布已独立审核的清理成果，不创建新产品版本，不改变radar-v2.75标签，不启动2.8。

基线：codex/mr-pre28-backlog-cleanup，HEAD与GitHub main均e89d3ec6e723ac52211e22d2ee571b0f414a3e3c。工作区原5 tracked+1 task完整保留。get_site现场确认v26/public/owner。已发布源0a863666c5b04c376738edee7443dafa223a3e50。

允许：原候选app/market-radar.tsx（三方图标未用import删除）、docs/CURRENT_STATE.md、docs/DEVELOPMENT_PROVIDERS.md、docs/HISTORY_FOUNDATION.md、tasks/ACTIVE.md、tasks/archive/MR-PRE28-BACKLOG-CLEANUP.md；额外仅README/CHANGELOG/docs/VERSIONS与本发布卡/归档。不改金融规则、测试、依赖、DB、采集、密钥/访问。outputs与真实数据不进入Git或部署。

复用同一候选已完成build/typecheck、lint逐项比较（3errors/6warnings→3/5，未lint-clean）、主bundle相同及独立GPT VERIFY。发布阶段精确验证app diff未变，不重复全套产品测试/审计，也不把历史检查当新测。DS此前2任务4次CLI，发布动作由协调者执行，本发布阶段DS0。

流程/验收：原生Sites打开→允许清单提交→GitHub main正常push→官方workflow推送准确源/打包→保存版本/部署→终态succeeded原生URL→实际sites-vNN标签和文档收口。只创建实际发布标签，不强推、不移动已有标签。保留受众与应用门禁。原生发布成功不等于生产登录后/真机QA通过。完整2.7和2.75性能缺口继续开放。

启动记录：首次官方workflow启动因自动审批服务连接中断未执行；原请求重试审批通过后执行。不是安全拒绝，未更换通道绕过。
