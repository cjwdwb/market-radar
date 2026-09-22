# Market Radar · 市场雷达

一个为桌面与手机设计的中文市场行情工作台。Market Radar 把真实行情、自选和价格提醒连接成一条清晰路径：查看市场、发现异常、理解证据、进入图表，再继续关注或设置提醒。界面采用黑白主调和低饱和涨跌色，适合长时间阅读。

![Market Radar 桌面界面](docs/screenshots/desktop-after.png)

## 功能

2.5 Market State Intelligence 已上线（Sites v23）。[打开市场雷达](https://market-radar-rex.swt-aether.chatgpt.site)。选中资产现在可查看独立于异常事件的方向结构与 RMS 波动对比：状态有明确观测窗口、指标、来源和失效原因，Classic 与 Radar 共用同一份结果。它描述已发生的数据，不预测价格，也不提供买卖评分。

当前发布进展见 [版本索引](docs/VERSIONS.md)。本地候选的99项Node测试、类型检查、构建及五视口专项通过；独立审计修复并复核完成。[精修报告](tasks/archive/MR-STATE25-REFINE.md)区分各次回归范围。旧2.45 iPhone往返已由用户实测确认；旧生产登录后补证按用户决定不再阻塞发布，不冒称新版本真机或生产登录后全面验收。

- 2.5 以已加载的完整K线计算固定窗口方向结构和当前/历史RMS对比；没有异常事件也可判断，数据过期、缺失、暂停或离线时明确降级。完整方法和证据默认折叠，保留主指标和限制；不增加行情请求或timer。连续相对表现留待后续，既有相对强弱事件不变。
- 修复极小价格和大额窄区间的折线刻度精度、图表隐藏/返回时尺寸警告，以及加载误显示为暂停的问题；手机详情层级更紧凑。

- Radar 2.45 统一面板、图表工具、自选与事件详情的视觉层级。运行设置提供「跟随系统 / 标准 / 减少」动效偏好，实时生效并保存；减少模式会立即取消装饰动画，保留焦点与选中反馈。

- Markets / Classic 与 Radar 双体验，默认体验可在运行设置中保存。
- Radar 共享自选与行情，识别价格异动、区间突破/跌破、波动和可靠的量能异常；支持来源追溯、有限会话历史、相对强弱、Confidence、组合事件与确定性摘要。
- Radar 2.2 提供自选覆盖概况、事件到图表的上下文跳转、返回 Radar 路径，以及复用同一份自选和价格提醒的工作流操作。
- Radar 2.4 在 Classic 与 Radar 之间共享当前资产的情报上下文：主事件、检测覆盖、数据可用性、事件方向关系和相对基准证据。详情默认折叠；自选与价格提醒保持独立，不生成资产评分或 AI 预测。设计契约见 [Asset Intelligence](docs/ASSET_INTELLIGENCE.md)。
- OKX 欧易 USDT 现货报价与 15 分钟 K 线。
- Yahoo Finance 美股、A 股、港股和兼容的旧 USD 交易对行情。
- K 线拖动、双指或 `Ctrl + 滚轮` 缩放、快捷回到最新行情。
- 最多 20 个本机自选，支持市场筛选、涨跌排序和价格提醒。
- 访问码保护；可选独立 Cloudflare Worker + D1 云端监控。
- 适配 320 px 手机、平板和桌面，支持键盘与 `prefers-reduced-motion`。

## 技术栈

React 19、TypeScript、Vinext、Vite、Tailwind CSS、Radix UI、Recharts 和 Cloudflare Workers。运行环境需要 Node.js 22.15 或更高版本。

## 本地开发

```bash
npm ci
cp .env.example .dev.vars
npm run dev
```

在 `.dev.vars` 中填写：

- `ACCESS_CODE_HASH`：访问码去除空格与连字符、转为大写后的 SHA-256。
- `ACCESS_SESSION_SECRET`：至少 32 个字符的随机字符串。
- `SITE_OWNER_EMAIL`、`MONITOR_URL`、`MONITOR_TOKEN`：仅启用云端监控时需要。

构建和测试：

```bash
npm run build
npm test
```

Windows 环境中的项目脚本依赖 Bash；也可以直接执行 `node node_modules/vinext/dist/cli.js build` 验证构建。

## 项目结构

- `app/market-radar.tsx`：行情工作台和主要交互。
- `components/candle-chart.tsx`：15 分钟 K 线及视口交互。
- `lib/market-data.ts`、`lib/okx.ts`：行情聚合与数据源。
- `worker/access-gate.ts`：访问码验证。
- `monitor/`：可选的云端定时监控 Worker 和 D1 schema。
- `tests/`：行情、提醒、访问控制、图表与刷新策略测试。
- `docs/`：架构、接口约定、设计决策和验证说明。

本轮视觉与交互改进的前后数据和截图见 [`docs/VISUAL_REFINEMENT.md`](docs/VISUAL_REFINEMENT.md)。

Classic + Radar 的规则、覆盖限制和验证结果见 [`docs/RADAR.md`](docs/RADAR.md)。

版本历史与回退点见 [`docs/VERSIONS.md`](docs/VERSIONS.md)，面向使用者的变更摘要见 [`CHANGELOG.md`](CHANGELOG.md)。`sites-vNN` 只表示已确认的 Sites 发布源码；`milestone-vNN` 和 `radar-v2.x` 表示可回退的 Git 产品里程碑，不宣称生产发布。开发过程以 `main` 为准。

## 数据与安全边界

行情接口可能延迟、限流或暂时中断。页面会保留并标记上次报价；过期、休市或失败报价不会触发提醒。系统只监控行情，不执行交易，也不需要交易账户凭据。

本机自选和提醒保存在浏览器。云端监控需要单独部署 `monitor/worker.mjs`、配置 D1 和服务端密钥。不要提交 `.env`、`.dev.vars`、访问码、Token 或构建产物。

项目中的品牌标识归其设计者所有。第三方行情数据受对应数据提供方条款约束。
