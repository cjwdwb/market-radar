# 项目速览
核对日期：2026-09-14；代码基线：87925c4。只记录已检查的仓库事实。

- 中文加密货币/美股/A 股/港股监控面板；主入口 app/page.tsx → app/market-radar.tsx。
- 技术栈：React 19、TypeScript、Vinext/Vite、Tailwind、Cloudflare Workers；依赖版本以 package.json 和锁文件为准。
- USDT 行情走 lib/okx.ts；股票及旧 USD 代码走 Yahoo，聚合在 lib/market-data.ts。
- 浏览器保存自选和提醒；另有可选独立 monitor/worker.mjs 云端监控及 D1 表。
- worker/ 管站点入口与访问门禁；app/api/ 管行情和云端代理；lib/ 管行情、提醒与刷新策略。
- components/、hooks/ 为 UI 支撑；tests/ 为 Node 测试；monitor/schema.sql 是监控存储。
- db/schema.ts 当前为空；不能因此推断整个项目无数据库。
- 站点发布使用既有 Sites 流程，.openai/hosting.json 保存站点身份；此任务不发布。

## 启动与测试
- Node 要求按 package.json：>=22.15.0；README 的 22.13 描述较旧。
- 安装/开发/构建入口：npm run install:ci、npm run dev、npm run build。
- 脚本依赖 Bash；构建还依赖 GNU timeout 和既有 Sites 环境。不要把这些脚本直接当成纯 PowerShell 命令重写。
- 行情和监控：npm run test:market。
- 单项：node --experimental-strip-types --import ./tests/register-types.mjs --test tests/refresh-policy.test.mjs
- 同样按需选择 market-data、monitor、quote-performance、chart-viewport、access-gate、navigation-section、ui-components 测试。
- tests/rendered-html.test.mjs 依赖 dist/server/index.js，须先成功构建。
- npm test = 构建 + 官方 Worker 类型生成与 tsc + 全部 tests/*.test.mjs；npm run lint 为既有检查入口。
- npm run typecheck 依赖构建输出 dist/server/wrangler.json，声明生成到被忽略的 .wrangler/types/worker-configuration.d.ts。详情见 RELIABILITY.md。
- 本次仅修改工作流文档，没有运行产品测试或验证部署。

## 文档入口
版本与回退点见 VERSIONS.md；架构见 ARCHITECTURE.md；协议见 API_CONTRACTS.md；决策见 DECISIONS.md；交接见 CURRENT_STATE.md。
README 的单一 Yahoo 来源、无云端监控描述与当前代码不一致；涉及这些行为时以上述实现为准。
