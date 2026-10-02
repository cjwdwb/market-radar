# MR-PUBLISH-HISTORY28-P0

2026-10-02。用户明确要求“上传部署”，授权将已验证P0修复合入GitHub main并发布现有Sites；先前仅限draft PR的边界由本次发布授权更新。

## Planner 与发布范围

基线：PR #1 head769a9054e84988dbdeaa214faf9f5b57e8426281，main27b0bab；修复实现57b3d0f。最终CI run37002521419/job110823234789在Ubuntu24.04.5/Node22.15/npm10.9.2执行npm ci→npm test成功，288/288、0失败/跳过。独立GPT审计及补证VERIFY完成，8个代码/测试/样例文件哈希固定。

原生产2.8 Foundation / Sites v28，source75cfa0658caa6356c47e8d0c85461b3029d0fccd。现场get_site确认active/public/owner、v28、automations=[]；project_id appgprj_6a9b9dc23584819190a31ae417863e7a。官方Sites workflow已打开当前checkout，未覆盖本地成果。

目标：发布SQLite生命周期、CLI可移植路径及演示样例稳定性维护修复。不新增产品版本号，不修改State/Signal/研究契约、schema、行情/刷新、访问策略/密钥，不启用采集/调度，不进入P1–P3。

允许路径：本任务卡、tasks/ACTIVE.md、docs/CURRENT_STATE.md、docs/VERSIONS.md、docs/P0_VERIFICATION_REPAIR.md、README.md当前发布行、CHANGELOG.md及必要发布记录。无新的产品改动。使用正常PR merge，不绕过保护；确认源码后按Sites官方workflow/source push/save/deploy，不能用版本号替代准确SHA。Windows本地归档若因缺Bash无法完成，记录实际失败并使用原生工具支持的同源无archive云构建fallback，不重写部署体系。

验证：复用输入未变的本轮Windows/浏览器/独立审计与最终PR CI；核对合并树，跟进main CI；原生部署succeeded且返回URL才报告成功。保存版本/部署/source/env revision，保留Windows文件symlink权限及生产登录后/真机未测限制。维护发布不自动创建新的浏览器验收或性能研究。发布后记录与部署源码分开。

无适合的新增DS任务；本次发布不再调用DS，不将配置可用记为参与。Sites操作仅由协调者执行。

状态：COMPLETE，已上传/部署并归档；完整2.8真实数据阶段未因此完成。

## 实际发布证据

- PR #1从draft转为ready后正常merge，合并提交 `12abdc84122cb15dda8f2a83d3fc2cde43e5cfb1`；既有产品修复57b3d0f和最终候选769a905保留原历史。未强推/绕过保护。
- 部署提交 `2ad04ee645ee588b16ede15c43fb093ed395419e`：相比已审计候选只添加发布任务卡/索引，8个代码/测试/样例哈希全部相同。
- GitHub main新CI run37003666727/job110826846543/attempt1实际checkout2ad04ee，Ubuntu24.04.5/image20260927.320.1、Node22.15.0/npm10.9.2；npm ci→npm test（build/typecheck/tests）成功，288/288、0fail/0skip。摘录outputs/p0/evidence/publish-main-ci-extract.log，在线 https://github.com/cjwdwb/market-radar/actions/runs/37003666727 。
- Sites version29：`appgprj_6a9b9dc23584819190a31ae417863e7a~appgver_0dee84a9a0dc819193543c7c12d4749c`。
- Deployment：`appgdep_6abf9c2244988191abab6a6709a5ff03`，2026-10-02T11:59:09.767794+00:00 原生状态succeeded，env_set_revision3。
- 正式网址：https://market-radar-rex.swt-aether.chatgpt.site 。受众仍public，应用访问码和配置未改。
- 发布标签sites-v29仅标记部署提交2ad04ee，不移动原radar-v2.8-foundation/sites-v28；发布后文档提交不再次部署。

工具过程：按sites-hosting官方workflow打开checkout并同步源码。发布workflow完成source push后，Windows归档子命令实际报“Unable to start the Sites workflow command / Site preparation command failed”；没有生成本地archive。随后官方open重新核对同一源码，用原生save_site_version无archive的云构建fallback保存v29，再显式deploy并跟踪至succeeded。不把本地归档失败称通过，不另造发布系统。

本次仅使用已有本机GitHub认证与短期Sites源码凭据，凭据不输出/落盘，不修改全局Git、站点密钥或访问设置。GitHub连接器写权限不足沿用既有本机GitHub认证；推送普通fast-forward。已核对Git无追踪数据库、.dev.vars、.env、outputs或work/state27文件。既有本地数据原位保留。

验收范围：P0本轮已验证Windows/Edge五视口和独立GPT审计复用，发布阶段新增main CI及原生部署证据。没有新增DS调用、生产登录后或iPhone实测；Windows文件symlink权限项仍未测（Linux对应项新CI已通过）。没有宣称全站真机/性能验收或完整2.8真实历史完成，未启用采集/cron、迁移或支付资源。
