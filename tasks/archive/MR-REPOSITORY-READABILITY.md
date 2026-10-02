# MR-REPOSITORY-READABILITY

2026-10-02。用户要求整理仓库、增加中文注释。基线 `c97852010eb2e8926fdbfcb2a4394cf80f8cada8`，工作区/暂存区干净；分支 `codex/mr-repository-readability`。现有生产为2.8 Foundation / Sites v28，源码75cfa06。

## Planner 定稿

- 目标：README成为清晰入口；现有docs有分类导航；项目速览与实际2.8目录/测试脚本一致；关键源码中文注释解释输入约束与原因。
- 发现：README堆叠多轮历史验收；PROJECT停在87925c4并保留已失效描述；ARCHITECTURE未列State/本地归档边界；历史包/回放/研究/异步导入关键保护缺少中文说明。
- 非目标：不重构算法、移动运行目录、改变路径/公开数据/样例时间、修改门禁/采集/依赖/测试断言；不删除历史任务或未完成项。不重新部署注释与文档。
- 允许路径：README.md、docs/README.md、docs/PROJECT.md、docs/ARCHITECTURE.md、.gitignore（仅注释）、lib/history/package.ts、lib/history/replay.ts、lib/radar/market-input.ts、components/radar/history-workspace.tsx、scripts/history-package.mjs（五个源码文件仅注释）、本卡及ACTIVE索引。
- 接口影响：无。数据位置仍以data/README.md为准，原始库/备份继续ignored；保留所有既有版本与发布记录。
- 验收：新增相对链接/关键路径真实存在；README明确模拟历史与真实实时行情、云监控与本地collector区别；注释与实现吻合；源码token及去注释编译结果与基线一致；受影响lint、历史相关现有测试、diff检查。无运行逻辑变化，不重复全量build/281测试或浏览器验证。
- 流程：沿用market-planner/builder/auditor，主代理分阶段执行，未新派DS或独立子Agent；审阅不称独立审计。无性能目标或瓶颈，跳过Optimizer。按上轮仓库上传授权同步GitHub文档/注释成果，原Sites部署源码保持不变。

## 执行与验证

已完成：README按功能/示例/开发/代码地图/保管与版本重新组织，旧逐轮验收以原专题和发布记录继续保留。新增docs/README导航，更新PROJECT运行说明、ARCHITECTURE边界和.gitignore中文分类。五个源码文件只增改注释，解释版本一致性、UTC、连续窗口、防前视、样本消重、稳定中位数、导入代次与失败保留。

本轮实际验证：

- 5个源码文件相对c978520的TypeScript非注释token完全一致；transpileModule在removeComments=true下的JavaScript输出逐字一致。未改算法、UI字符串或执行语句。
- .gitignore去注释后模式完全一致；work/state27、data/local、outputs、.dev.vars仍被忽略，Git仅追踪data/local/.gitkeep，无原始库/日志进入本次提交。
- 65个本地Markdown链接及使用的中文锚点检查通过，无缺失路径；编码与git diff --check通过。
- `node node_modules/eslint/bin/eslint.js lib/history/package.ts lib/history/replay.ts lib/radar/market-input.ts components/radar/history-workspace.tsx scripts/history-package.mjs`：通过，0诊断。
- `node --experimental-strip-types --import ./tests/register-types.mjs --test tests/history28.test.mjs tests/history28-release.test.mjs`：12/12通过；包含隔离版本导出/跨进程/新空库恢复，不是生产采集。
- 未重跑全量281、build、typecheck或浏览器：本轮无执行代码变化，等价性检查与受影响验证已覆盖；README所列281/19明确标为此前发布证据。

按market-auditor流程由主代理复核稳定diff、未跟踪文件、实现对应说明、链接、忽略规则和测试结果，无confirmed finding；这是主代理复核，不称独立审计。DS实际0，本轮未新派子Agent，无Optimizer。

完成的是仓库可读性整理，不修改原2.8未完项。GitHub同步沿用既有上传授权；无需重新部署网站，生产仍Sites v28/source75cfa06，不创建新标签或版本。
