# MR-PUBLISH-HISTORY28-P0

2026-10-02。用户明确要求“上传部署”，授权将已验证P0修复合入GitHub main并发布现有Sites；先前仅限draft PR的边界由本次发布授权更新。

## Planner 与发布范围

基线：PR #1 head769a9054e84988dbdeaa214faf9f5b57e8426281，main27b0bab；修复实现57b3d0f。最终CI run37002521419/job110823234789在Ubuntu24.04.5/Node22.15/npm10.9.2执行npm ci→npm test成功，288/288、0失败/跳过。独立GPT审计及补证VERIFY完成，8个代码/测试/样例文件哈希固定。

原生产2.8 Foundation / Sites v28，source75cfa0658caa6356c47e8d0c85461b3029d0fccd。现场get_site确认active/public/owner、v28、automations=[]；project_id appgprj_6a9b9dc23584819190a31ae417863e7a。官方Sites workflow已打开当前checkout，未覆盖本地成果。

目标：发布SQLite生命周期、CLI可移植路径及演示样例稳定性维护修复。不新增产品版本号，不修改State/Signal/研究契约、schema、行情/刷新、访问策略/密钥，不启用采集/调度，不进入P1–P3。

允许路径：本任务卡、tasks/ACTIVE.md、docs/CURRENT_STATE.md、docs/VERSIONS.md、docs/P0_VERIFICATION_REPAIR.md、CHANGELOG.md及必要发布记录。无新的产品改动。使用正常PR merge，不绕过保护；确认源码后按Sites官方workflow/source push/save/deploy，不能用版本号替代准确SHA。Windows本地归档若因缺Bash无法完成，记录实际失败并使用原生工具支持的同源无archive云构建fallback，不重写部署体系。

验证：复用输入未变的本轮Windows/浏览器/独立审计与最终PR CI；核对合并树，跟进main CI；原生部署succeeded且返回URL才报告成功。保存版本/部署/source/env revision，保留Windows文件symlink权限及生产登录后/真机未测限制。维护发布不自动创建新的浏览器验收或性能研究。发布后记录与部署源码分开。

无适合的新增DS任务；本次发布不再调用DS，不将配置可用记为参与。Sites操作仅由协调者执行。

状态：PLANNED，等待实际合并与发布证据。
