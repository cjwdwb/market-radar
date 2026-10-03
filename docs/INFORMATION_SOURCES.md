# 官方项目与公司产品资料

2026-10-03，[任务卡](../tasks/MR-29-INFORMATION-SOURCES-PUBLISH.md)。在已验证的[FED入口](INFORMATION_DELIVERY.md)之上新增有限官方资料。基线main `2ad86814abf5a0f40c50d7ad463d1de6633a859f`，CI run37115019039成功；发布前生产Sites v31/source c28de66。实际发布另记，不把本地测试当生产验收。

## 实际覆盖

| 关联资产 | 官方项目/产品 | 已保存记录 | 限制 |
| --- | --- | --- | --- |
| BTC | bitcoin/bitcoin | 5 | Bitcoin Core客户端，不是全部比特币消息 |
| ETH | ethereum/go-ethereum | 5 | Geth客户端，项目许可见原文，不统一称所有组件LGPL |
| SOL | anza-xyz/agave | 5 | Anza客户端，不是Solana全网公告 |
| NVDA | NVIDIA/open-gpu-kernel-modules | 5 | 开源GPU驱动产品，不是公司财报/新闻 |
| MSFT | microsoft/PowerToys | 5 | PowerToys产品，不是公司财报/新闻 |
| 宏观 | Federal Reserve Board货币政策 | 2 | 前轮真实资料沿用，本轮不重抓 |

核对GitHub Terms D.6/H、官方仓库和许可，只保存ID、版本号、发布/更新时间、预发布标记和官方链接。不复制正文、创作性标题、作者/头像或代码；软件许可证不作为整站新闻转载许可。Agave rc名称与来源prerelease=false同时保留，界面不称“稳定版”。

SEC三个标准入口403，未绕过；NVIDIA新闻条款3.1/3.2限制公开展示；Microsoft新闻转载许可未核实；Nasdaq文档超时。**公司申报、财报、媒体新闻、A/H股信息仍未接通**。免费非商业不替第三方授予许可。每源仅取得的一页，不承诺全部历史/新闻或100%覆盖。

## 真实保存、费用与恢复

- 本轮来源调查24 HTTP、已接收1,353,312字节，包括14 GitHub API请求；在调查24请求/16MiB限额内。五份已有响应直接用于入库，没有重复下载。
- SHA与经复核文件mtime冻结在capture manifest，receiptBasis=reviewed_capture_mtime，说明保存时间证据，不伪称精确网络收包时刻或过去在线观察。首次/版本入库与导出时间另存。
- 25事实版本、5来源快照；五源重复导入新增0。A→B→A及旧快照由隔离测试验证，真实来源未发生该修订，不冒称真实案例。
- 公开包14,435字节，viewId `376f9590af0ae7ce3d4823914052835820e52ea990017fbf3db4e33927fbd95e`，reconstructed/current-vintage，非PIT。
- 原库和VACUUM INTO一致备份各45,056字节；备份SHA `bb91c366066f931bc2acaf2dfd864889b841fb337f24765c2477d8c60415fa57`。新空目标恢复，再独立进程逐表/查询比对：25版本/5快照/14请求一致，恢复禁采集，原库未覆盖。
- 14次调查API请求在既有24请求调查授权内，继承进账本；超过后续更新12/滚动日上限，当天更新正确拒绝，不重置消耗。之后每批最多5请求/10MiB/2分钟、1100ms间隔、20秒超时/2MiB响应。拒绝/429停止并保存冷却，无自动重试。
- 无购买/新增订阅，新增订阅费$0；流量/存储及DS账单未核对，不称总费用0。同机ignored库和备份不是异地长期保管。

## 网站与手动入口

Radar → 默认折叠“项目与公司更新”，首次展开读取固定审核包。当前资产/币圈项目/公司产品/全部四种范围，五条分页，原文及出处时间详情。未知资产提示未覆盖；取消/新请求使旧响应失效，失败保留明确身份的旧资料。页面刷新只读已发布快照，不执行外部采集。

GET `/api/asset-information`继承应用门禁，固定128KiB/25条上限、拒绝参数，无任意URL/路径/SQL。FED继续`/api/information`及原导入。未改行情/State/提醒/偏好/访问配置，无新增常驻timer。

操作员命令（项目根，Node≥22.15）：

- `node scripts/official-information.mjs status`：固定库只读状态。
- `node scripts/official-information.mjs refresh`：唯一权威库手动有限更新，先持久预留请求，五个固定来源，无调度。不要复制启用第二库绕预算。
- `node scripts/official-information.mjs publish`：零HTTP，校验后原子替换固定公开包；不自动上传部署。
- `node scripts/official-information.mjs backup <新文件名.sqlite>`：一致备份和校验manifest。
- `node scripts/official-information.mjs restore <备份.sqlite> <新目标.sqlite>`：校验后恢复新空目标、默认禁采集，禁止覆盖canonical库。

文件及manifest/pending路径均限于`work/state27/official-information`，拒绝目录穿越和链接。数据库、原响应、账本、备份和日志不进Git。没有通用enable入口；恢复续跑须核对权威库及继承预算。本次是手动批次，不是24小时持续服务。

## 验证与审计

修复后Node22.15专项12/12 PASS；完整386项：385 PASS/0 FAIL/1 SKIP（既有Windows文件symlink权限，junction另测）。分项`--experimental-strip-types --import ./tests/register-types.mjs --test tests/*.test.mjs`、`node node_modules/vinext/dist/cli.js build`、`node scripts/typecheck.mjs`和受影响eslint通过，未称Windows npm test包装已跑。既有chunk警告保留。

修复后radar.mjs/RADAR_OFFICIAL_INFORMATION_ONLY=1在禁止外部网络的生产等效workerd、Edge149.0.4022.98运行，**23组PASS**。五视口1440×1000/768×1024/390×844/320×740/844×390，各检查新资料/FED快照/旧导入，含键盘44px、筛选分页、错误取消竞态、资产/手动周期与三档动效。资料真实、周边行情与登录为fixture，非生产/真机。pageerror=[]；6条console HTTP错误来自刻意400/405/503用例，不隐瞒。主代理实际查看手机截图，无横向溢出；生产登录后和iPhone本轮NOT RUN。

独立GPT审计发现P2备份子根守卫过宽、P3 Geth许可标签不一致；修正为子根/伴随路径守卫并加负向测试、采用中性原文许可标签。最终VERIFY见任务卡。无实测性能瓶颈，Optimizer跳过，不承诺FPS提升。

DS本轮deepseek-worker/deepseek-flash只读三个批准UI/测试文件，15,943 tokens，无写入/网络。GPT采纳lazy load、取消/上下文切换与错误用例；来源/身份/存储/测试核验及独立审计由GPT负责。前轮8,953 tokens另记FED报告，不混算。

本地证据：`outputs/information-sources29/{source-ledger.json,capture-manifest.json,real-import.json,restore-final.json,fix-tests.log,node-final.log,build-final.log,typecheck-final.log,lint-final.log,browser-final/verification.json}`。原数据/巨型日志不上传。自动审批曾拦截含终止旧预览进程的重启命令，未重试终止；旧服务20分钟自行退出，新独立端口完成最终验证。
