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
- 已普通上传45文件，源码提交5a06c46a0b7e63fd3fed48d76c8c309fee1f9a52，分支codex/mr-29-c-research-workflow；[草稿PR #2](https://github.com/cjwdwb/market-radar/pull/2)。未合并/打标签/部署。
- 新测GitHub CI [run37096381509](https://github.com/cjwdwb/market-radar/actions/runs/37096381509)，job111127064533：Ubuntu24.04.5 / Node22.15.0 / npm10.9.2，npm ci→npm test（build/typecheck/Node）成功；344/344，0失败/跳过。实际checkout dcceeeda171b5f2ac70a07ddd27c86e037f01388是GitHub PR测试合并引用，tree cce8b44dabe2c6017b9838a6429c7655a04b5a35与上述源码提交相同；不表示已合并main。
- 既有>500KB chunk警告、Actions运行时弃用提示仍存在，不把CI成功称为零警告。原Windows1SKIP保留为历史本机限制，Linux344/344单独记录。
- 45文件上传清单无数据/秘密路径，高置信凭据签名0；原CSV/DB/backup/outputs仍忽略。上传前产品12文件与五月审计指纹一致；GPT独立只读上传审计无新增finding。
- 完整提交diff检查额外发现新parser文件末尾空白行，已仅去除该空行并新跑parser17/17；不改数据/功能，源字节hash相应变化，不能继续宣称该文件与旧指纹字节完全相同。本收尾提交同时更新上传文档；其独立CI结果以PR最新check为准，不把上一SHA的CI说成本提交已通过。
- 新官方来源核对：两个CSV路径最新commit均2026-05-24，九月0/60维持；新读取为文档/元数据，不是新增价格采集。没有扩采/购买/云调度。
- 工具：本机无gh；既有Git认证普通push，连接器创建draft PR并读CI。提升权限执行与原worktree所有者不同，使用本次命令精确safe.directory，不改全局配置；凭据未读取/输出/落盘。
- 当前上传与2.9完整交付分开：五月46/48在本机可查询，九月/原生分钟/更早覆盖/长期外部保管/真实研究仍开放；生产2.8 Foundation P0/Sitesv29未改变。DS实际0、无Optimizer，无新浏览器/真机或线上验收。
- 上传任务归档，主数据任务保持开放；最终分支与CI可从上述PR复查。
