# Classic + Radar

2.4 增加统一 Asset Intelligence Context：在现有 Intelligence 之后派生 selected asset 的 current events、主事件、覆盖/时效、方向关系与相对证据引用。Classic 和 Radar 共用父组件同一个 Context，仍保持原导航与用户状态。契约见 [ASSET_INTELLIGENCE.md](ASSET_INTELLIGENCE.md)；2026-09-18 已发布为 Sites v21，发布证据见 tasks/archive/MR-PUBLISH-ASSET-INTELLIGENCE.md。

Market Radar 有两种体验，共用一个页面状态、访问门禁、自选、行情、价格提醒和设置。

- **Markets / Classic**：主动查看市场、图表、自选和价格提醒。
- **Radar**：从已加载的标的中发现异常事件；My Radar 使用同一份自选。
- **运行设置 → Market Experience**：选择下次访问根路径时默认打开的体验。导航切换不会覆盖默认值。

## 导航与保存

继续使用现有单页架构：`/#overview`、`/#radar`、`/#watchlist`、`/#price-alerts`、`/#price-chart`。设置继续使用弹窗。明确锚点优先于默认体验；服务端稳定渲染 Classic，客户端读取偏好后选择默认模式。

`marketMode: "classic" | "radar"` 保存于现有 `market-radar-preferences-v1`。信号最多保留 120 条当前页面会话记录，不写 localStorage 或云端数据库。页面刷新后重新建立扫描会话。

## 数据边界

`MarketRadar` 既有 Quote / History → `lib/radar/engine.ts` → 去重与生命周期 → `useRadar` 会话 store → `RadarFeed`。

Engine 是显式输入 snapshot、now、enabled 的纯函数，无网络、浏览器存储或定时器。Hook 复用父组件现有时钟与快照。切换模式不重新建立行情请求；Classic DOM 保留，图表状态可继续使用。

扫描范围仅为现有自选、市场概览、当前标的与启用提醒涉及的标的，不是全市场扫描。过滤器仅展示当前加载范围涉及的市场。

仅接纳来源与币种一致、最近查询不超过 2 分钟、报价不超过 3 分钟的输入。股票还要求常规交易中且声明延迟不超过 2 分钟。历史基线取最新连续段，至少 22 根完整 K 线，排除午休、隔夜和缺失点形成的缺口。旧报价、失败或基线不足的标的独立退出扫描。

## 第一阶段信号

| 信号 | 依据 | 当前支持 |
| --- | --- | --- |
| 价格异动 | 完整 K 线的 5m / 15m / 1h 变化，相对近期同周期绝对变化中位数的 3 倍，另有噪声下限 | Crypto 15m/1h；股票 5m/15m/1h，各窗口需至少 5 个参考窗口 |
| 区间突破 / 跌破 | 最新完整收盘价越过之前 20 根 high/low，并超过近期波动缓冲 | 有完整范围数据的标的；不是 24h high/low |
| 波动放大 | 最近 4 根收益率均方根，相对之前 16 根基线 | 可用连续历史的标的；非年化波动率 |
| 成交量异常 | 完整 15m 成交量达到前 20 根均量 2.5 倍 | 仅 OKX USDT 基础币成交量；不使用 24h 成交额 |

Radar 2.1 已加入使用同步真实 benchmark 的相对强弱，以及 evidence、confidence、clustering、ranking 与 60 分钟 summary；完整定义见 [INTELLIGENCE.md](INTELLIGENCE.md)。

**DEFERRED**：加密 5 分钟数据、股票成交量（需可靠时段基线）、跨设备持久 Radar history。不为缺失数据创建模拟信号。

## 生命周期与来源

每条事件保存来源、币种、报价时间、K 线结束时间、首次检测时间、状态更新时间与必要计算指标。报价更新不会反复创建同一事件，也不会插值价格。

- fingerprint 区分标的、类型、周期、来源、间隔；价格异动额外区分方向。
- 低于触发强度的 70% 视为恢复；新事件需要新证据、已恢复且经过 30 分钟冷却。
- 事件有效期为 K 线结束后 45 分钟；失去有效输入、暂停或超时后过期。
- `active / resolved / expired` 分别表示异常持续、已恢复、已过期；可通过“包含历史”查看后两者。
- 正在监控的未恢复事件不因跨日被重新触发；移出扫描的冷却记录最多保留 128 条且最多 24 小时。

## 2.3 — 同一资产，两种视图（本地实现）

Classic 图表的轻量 Radar 入口消费当前 `radar.intelligence.events`，只展示该资产活跃事件数与按原排序得到的主事件。无数据、暂停和无活跃事件分别显示；不会在 Classic 重算 Signal、Confidence 或相对强弱。

点击入口进入同一资产的 Radar 上下文，突出主事件，证据仍默认折叠；全局摘要暂时收起。资产筛选是临时覆盖，退出后恢复原有市场筛选，Feed 的历史开关和未卸载卡片的展开状态继续保留。返回图表沿用用户选择的范围，只有主动打开事件才调用已有的周期建议。

From Radar 仅存 `symbol/eventId` 引用，显示时从最新 Intelligence 解析。恢复、过期或组合变化不会继续显示缓存的旧事件；原事件不再存在时明确提示。切换资产（概览、快速栏和自选表）都会使不匹配的来源失效。普通导航不持久保存来源、筛选上下文或滚动位置。

自选和价格提醒仍消费父组件唯一状态。事件展开区显示启用的价格提醒数量；已有提醒时进入 Classic 提醒列表，不再重复打开新建表单。价格提醒明确标为用户条件，与 Radar 系统检测分开。

新增 provider symbols、API、Radar timer、Signal/Intelligence engine 均为 0；模式切换不改变请求依赖。用户切换资产或图表范围仍可触发现有历史请求。

最终本地验证（产品源码 `009c2a9`）：30 项 Radar 相关测试、全量 70 项 Node tests、构建和类型检查通过。用户允许后，Edge 完整脚本实际执行并通过 30 项检查：1440×1000、768×1024、390×844、320×740、844×390 均无横向溢出或 pageerror；覆盖双向导航、手动范围保留、Watch/Alert、暂停、换资产及自选表回归、错误/空/慢请求、键盘和实时 reduced-motion。请求测量窗口用 Playwright 时钟暂停既有轮询、逐次推进导航帧；上下文往返和八次普通导航均新增 0 个 API 请求。这是隔离导航副作用的测量，不代表关闭或改变生产轮询。

独立审计发现并修复 1 MEDIUM（表格绕过统一选中入口），Auditor 代码 Verify 无剩余 finding；最新浏览器回归亦通过。报告位于 `outputs/radar/verification.json`，截图位于 `outputs/radar/integration-*.png`；均在本地忽略目录，测试行情不进入应用。未验证真机 Safari、线上行情或生产 2.3。

主 client chunk 726,707 → 730,018 bytes（约 +0.46%，最终数值以本轮构建为准），既有 500 KB warning 保留；无已证明瓶颈，Optimizer 跳过。未做自选行徽标、大型情报面板、精确滚动恢复、新信号、AI、D1 历史或 Market State。2.3 已于 2026-09-17 发布为 Sites v20，源码 f96a526；本节验收仍为发布前本地记录，未新增发布后线上浏览器复测。

## 第一阶段验证结果（2026-09-15，基线 3bf421a）

后续可靠性优化已修复下述历史类型问题并复测行情，最新结果见 [RELIABILITY.md](RELIABILITY.md)。以下保留第一阶段记录。

- 43/43 Node tests 通过，含 14 项 Radar 专项测试。
- Vinext 构建成功；保留既有大于 500 KB chunk 提示。
- 新增 Radar 代码、专项测试与浏览器脚本 ESLint 通过。
- Edge 浏览器：1440×1000、768×1024、390×844、320×740、844×390 均无页面横向溢出。
- 默认体验刷新保留、明确 Classic 锚点、自选双向同步、信号回跳与近期记录、展开图表后提醒导航及创建均通过。
- 连续 8 次体验导航新增 API 请求 **0**；这是本次浏览器观测，不是对所有负载或帧率的承诺。
- 正常、平静、过期、全部失败、局部失败、空历史、慢请求、存储不可用、键盘焦点、实时减少动态、首次开场与重复访问均通过；无 pageerror。
- 独立 Auditor 发现并复核修复两项 P2：跨日未恢复异常重复事件、价格方向反转被去重吞掉。最终复核无新增可证实问题。
- 实连重试取得 OKX 96 根历史及 A 股/港股收盘报价；BTC/NVDA 报价请求失败。有效报价不齐或已休市时产生 0 条信号，未验证到真实异常触发。
- 独立 `tsc --noEmit` 仍受现有 Cloudflare 类型声明缺失影响（`cloudflare:workers`、`Fetcher`、`D1Database`）；不是全仓类型检查已通过。未运行真机 Safari、生产部署或云端信号验证。

浏览器复现入口：`tests/browser/radar.mjs`，需要可用 Playwright、Edge、本地预览和被忽略的 `.dev.vars`。可用 `PLAYWRIGHT_MODULE` 指定现有 Playwright 路径。测试仅在独立浏览器上下文拦截请求；截图和报告进入被忽略的 `outputs/radar/`，不会被应用导入。

Optimizer 本轮跳过：没有测得需要专门优化的新增瓶颈，不为完成流程修改刷新频率。
