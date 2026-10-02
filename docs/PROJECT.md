# 项目速览

2026-10-02依据代码基线 `c978520` 定向核对。生产版本见[CURRENT_STATE.md](CURRENT_STATE.md)，全部文档见[README.md](README.md)。文件存在不证明云资源已配置。

## 代码边界

- `app/page.tsx` → `app/market-radar.tsx`：Classic/Radar共用选中资产、自选、提醒及已加载行情。
- `lib/market-data.ts`聚合行情；USDT走 `lib/okx.ts`，股票与兼容USD代码走Yahoo。
- `lib/radar/market-input.ts`校验共用输入；Engine → 原始会话数据 → Intelligence。State从有效行情独立派生，不使用事件数量投票。
- `lib/radar/asset-state-v2.ts`复用基础数学，提供双窗口、相对表现、Alignment和历史窗口比较；`watchlist-state.ts`用于有限自选集合。
- `lib/history/`校验模拟历史包并独立回放/研究；`components/radar/history-workspace.tsx`显式读取本地文件，不把旧记录写回实时行情。
- `collector/store.mjs`使用Node SQLite，schema在 `collector/schema.sql`，runner与导出入口在 `scripts/`；固定FED元数据准入和fixture价源分开。详见[历史基础](HISTORY_FOUNDATION.md)。
- `worker/`管网站门禁，`app/api/`管行情和云监控代理；独立 `monitor/worker.mjs`与 `monitor/schema.sql`属于可选云监控。
- `db/schema.ts`为空不等于无数据库：collector SQLite、monitor D1与网站配置须分开理解。
- `.openai/hosting.json`保存既有Sites身份；本地开发、GitHub提交和生产部署是不同动作。

## 本机配置

从 `.env.example`首次创建 `.dev.vars`，保留已有文件，不提交真实值。

| 名称 | 用途 |
| --- | --- |
| `ACCESS_CODE_HASH` | 访问码去除空格/连字符并转大写后的SHA-256 |
| `ACCESS_SESSION_SECRET` | 本机独立随机值，至少32字符，用于签名访问会话 |
| `SITE_OWNER_EMAIL`、`MONITOR_URL`、`MONITOR_TOKEN` | 仅启用独立云监控时使用 |

## 开发与验证

Node要求 `>=22.15.0`，命令从仓库根目录执行。下表描述脚本行为，不代表本轮全部运行。

| 用途 | 入口 | 前置条件 / 注意事项 |
| --- | --- | --- |
| 本机安装 | `npm ci` | 按锁文件安装，避免并发安装 |
| 受管Linux安装 | `npm run install:ci` | 需要Bash、flock、GNU timeout等工具 |
| 开发预览 | `npm run dev` | POSIX环境变量写法，PowerShell入口见下文 |
| 标准全量验证 | `npm test` | 已串联build → typecheck → tests/*.test.mjs |
| 仅构建 | `npm run build` | Bash/Sites环境包装与GNU timeout |
| 类型检查 | `node scripts/typecheck.mjs` | 先有dist/server/wrangler.json，生成官方Worker声明后tsc |
| 行情/云监控测试 | `npm run test:market` | 两组现有Node测试，不执行生产采集 |
| 单项测试 | `node --experimental-strip-types --import ./tests/register-types.mjs --test tests/history28.test.mjs` | 按受影响领域选择；rendered-html另需构建产物 |
| lint | `npm run lint` | Bash包装；检查部分文件可用node node_modules/eslint/bin/eslint.js加路径 |

PowerShell可分别执行以下入口，不把分项成功写成未运行的 `npm test` 包装命令通过：

```powershell
# 启动服务；按Ctrl+C停止后，再执行需要的验证
$env:WRANGLER_LOG_PATH = '.wrangler/wrangler.log'
node node_modules/vite/bin/vite.js

# 相同Vinext构建器，然后生成Worker声明并检查类型
node node_modules/vinext/dist/cli.js build
node scripts/typecheck.mjs

# rendered-html测试依赖dist/server/index.js
node --experimental-strip-types --import ./tests/register-types.mjs --test tests/*.test.mjs
```

## 浏览器、历史工具与证据

- `tests/browser/radar.mjs`只接受loopback，有行情拦截、测试认证及本地状态设置，**不能指向生产**。按需使用 `RADAR_HISTORY28_ONLY=1`、`RADAR_FED27_ONLY=1`等入口，先准备Playwright模块和测试服务。
- 导出/研究说明见[HISTORICAL_INTELLIGENCE.md](HISTORICAL_INTELLIGENCE.md)；collector运行/恢复说明见[HISTORY_FOUNDATION.md](HISTORY_FOUNDATION.md)。访问页面不会启动采集。
- 公开示例、本地库和备份统一见[data/README.md](../data/README.md)。`data/local/`是预留目录，既有runner限定在 `work/state27/`，不要因整理文档搬动数据库。
- 原始日志与截图放被忽略的 `outputs/`；精选公开证据放 `docs/evidence/`、`docs/screenshots/`，注明真实/模拟、环境和版本。
- 文档或纯注释变更优先核对链接、代码等价性与相关检查；不机械重跑全量构建。既有lint、真机和真实数据限制见各任务报告，历史结果不替代新验证。
