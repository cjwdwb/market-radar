# MR-UPLOAD-HISTORY29 — 上传已验证历史工作台候选

2026-10-03；用户明确“上传吧，为什么九月份的一直都是0”。本次上传授权适用于已验证A/B/C及Coin Metrics有限日频成果；不沿用旧部署授权。

## PLAN
- 基线：本地codex/mr-29-c-research-workflow / HEAD31702c45c653e5e33bac258c110f159d432d5b87；GitHub main本轮读回同SHA。工作区44个既有修改/新增文件按实际Git清单复核，暂存为空，保留所有既有成果。
- 目标：已审计产品/测试/文档提交到当前分支、普通push到github remote、创建draft PR并检查Ubuntu/Node22 CI；不合并main、不tag、不部署/迁移/启动采集。
- 允许路径：本卡、ACTIVE、CURRENT_STATE、HISTORY_STAGE_A及既有已验证候选文件的Git提交；outputs下仅本机脱敏上传核对证据。无新功能/依赖/行情或方法改动；CI如揭示实际缺陷则限定修复/复测/复核。
- 原始CSV/SQLite/备份、outputs、环境文件、私有自选与凭据不进入Git。GitHub文件为实现/测试及摘要，不冒称数据库已公开上线。
- 九月核查：本轮官方GitHub csv/btc.csv与csv/eth.csv最新提交均仍f1a36afb962731c387bb03982758ab0103063da5（2026-05-24T13:37:39Z）；与已下载固定版本一致。两元数据查询不下载CSV/不产生新采集批次。源文件最后日期May24且当天PriceUSD空，批准九月0/60不是页面过滤/恢复失败。不是对所有Coin Metrics服务都无九月数据的结论。
- 验证：先比对已审计候选hash、上传清单/忽略规则/秘密特征、diff check、既有文档与真实46/48/九月0证据。产品hash不变不机械重跑本地全量；复用上轮343PASS/1SKIP、build/typecheck/浏览器/独立审计，远端CI按实际新测记录。
- 上传方式：普通非强推独立分支；核对远端commit与本地一致；PR有清晰范围/覆盖/限制/验证。GitHub CLI未安装可用连接器或已有Git认证，凭据仅内存不日志/落盘。
- GPT最终上传清单/证据独立只读复核；DS本次无适合的实现任务、实际0；无性能改动/Optimizer。
- 成功标准：GitHub已存在准确候选commit、草稿PR和实际CI状态；失败如实修复或记录。九月缺口及完整2.9未达项保持开放。

## 执行结果
待执行，不预填成功。
