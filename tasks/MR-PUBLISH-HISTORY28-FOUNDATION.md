# MR-PUBLISH-HISTORY28-FOUNDATION

2026-10-02。用户明确授权“完善一下可以上传部署了，文件数据这些可以整理放在项目里”。起点codex/mr-historical-intelligence-28、HEAD1f87fc6，保留全部已独立审计的未提交2.8成果。Sites现场active/public/owner/v27，无schedule；官方workflow已打开原checkout，未覆盖改动。

目标：将已验证的历史查询/回放/研究隔离里程碑整理为2.8 Foundation阶段发布；不是完整2.8/2.7真实数据验收。Planner→Builder受限收尾→相关tests/build/typecheck→独立审计新增差异→GitHub/Sites发布→准确版本记录。

允许：原MR-HISTORICAL-INTELLIGENCE-28候选路径；额外public/examples/history28-fixture.json、public/examples/fed-monetary-20260923.json、data/README.md、data/local/.gitkeep、docs/evidence/history28/*（精选脱敏检查摘要）、docs/screenshots/history28-*.png、scripts/prepare-history28-example.mjs、tests/history28-release.test.mjs、components/radar/macro-timeline.tsx的示例下载链接、README/CHANGELOG/docs/VERSIONS/CURRENT_STATE/HISTORICAL_INTELLIGENCE、.gitignore及任务索引/发布归档。

完善范围：模拟历史示例可重复生成/校验；已批准FED公开视图仅2条元数据复制（parseFedView核对、归属/来源/时点保留），不含owner/alerts/settings/数据库/备份；页面只增加下载并明确导入位置，微调说明文案/嵌套框。不会伪造真实价格、放松parser/live gate、改数学/采集/schema/密钥/门禁。

文件分层：public/examples为明确可公开数据；data/README列目录与适用身份；data/local忽略（预留本地资料），现有work/state27库原位保留并在索引说明，不破坏原runner路径。不能把项目目录当作异地备份，不执行真实数据库迁移/清理。已授权文件整理不等于取得新的供应商许可或连续采集权。

验收：静态样例parse通过/fixture可重复/来源元数据无个人字段；下载链接本地认证会话可用；导入/失败保留/五视口既有history28/fed27复测，related Node、build/typecheck、受影响lint；原279测试与独立审计以相同domain复用，变化后按风险运行全量。审计固定diff、数据清单、发布包未含数据库/凭据。

发布：普通非强推GitHub main（远端先核对），官方Sites source workflow、保存准确源码版本、保持现有public+应用门禁并部署；仅终态succeeded后写sites-vNN。新产品标签radar-v2.8-foundation，既有标签不移动。外部条件未满足项仍由原2.8任务跟踪，不归档为全部完成。

当前未发布，结果待记录。发布动作由协调者，复用前轮DS纯展示组件；本发布收尾不新增Provider任务。

## 发布前检查

正式添加的公开文件仅302根模拟OHLC与两条既有FED元数据（原viewId不变），项目内原始数据库/备份保持ignored原位。data/README与精选19条浏览器检查、两张fixture截图已整理。工作目录之外未作数据搬迁或清理。

本轮新测：281/281全量Node（原279+示例2）、专项12/12、build/typecheck、受影响lint通过。历史10条、宏观9条浏览器检查通过，均五视口/三档动效和errors=[]/warnings=[]；下载测试先遭遇HTTP loopback客户端不发Secure Cookie，返回门禁HTML，改为认证页面fetch且断言JSON后通过，不改访问控制。主JS790028/总1067532 bytes。

独立GPT新增收尾检查：示例2/2重跑通过、FED同原文件、无私有字段、DB/backup/local递归忽略与Git未追踪检查通过；产品无新finding。最终精选报告/截图/发布说明独立VERIFY PASS，与实际10/9条报告和281Node一致，未见私有信息或未解决finding。只发布Foundation，不以公开宏观或fixture代替真实价格/正式保管/前瞻研究验收。原2.8任务继续开放。

用户本轮已接受数据文件存放项目内，本机资料位置按data/README确定，无需重复确认这一点；异地备份、保留期限和真实来源权限仍未由这句话解决。
