# 架构与阅读索引
2026-10-02补齐截至 `c978520` 的State和本地历史边界；原行情细节来自87925c4阶段核对。运行环境是否已配置不由代码存在推定。运行入口见[PROJECT](PROJECT.md)，专题导航见[README](README.md)。

浏览器 → worker/index.ts 门禁 → Vinext app router → app/api → lib/market-data.ts → OKX / Yahoo。
独立云端链路：站主登录 → app/api/monitor → MONITOR_URL → monitor/worker.mjs → D1。

当前主要数据路径：

```text
已加载行情 snapshot ──→ Engine → 原始会话数据 → Intelligence → Radar / Asset Context
                  └──→ 输入校验 → Asset State V2 / Watchlist State → Classic / Radar

显式本地runner → collector SQLite → 固定版本导出 → 用户导入 → 历史查询 / 回放 / 研究
                                                  └──→ 宏观资料时间线（独立格式）
```

State读取有效行情，不从事件数量推断市场状态。历史回放只复用数学，使用独立历史有效性契约，不伪造实时Quote/fetch信息。当前历史价格入口仅接受fixture；获准FED元数据不等于真实价格来源已准入。本地归档不会因页面访问启动采集，也不会把查询结果回写实时snapshot或提醒。

2026-09-15：Classic / Radar 共用 app/market-radar.tsx 状态与请求。quotes/trends snapshot → lib/radar/engine.ts（纯检测/证据/去重/生命周期）→ raw session store → lib/radar/intelligence.ts（confidence/clustering/context/ranking/summary）→ radar-feed.tsx。Benchmark 合入已有轮询分组，不进入自选或 Classic UI；无新增 API、数据库或定时器。规则见 RADAR.md 与 INTELLIGENCE.md。

| 关注点 | 首要文件 | 边界 |
| --- | --- | --- |
| 页面/本地保存/轮询 | app/market-radar.tsx | localStorage；共同状态与调度入口，优先按符号定位 |
| 访问控制 | worker/access-gate.ts、worker/index.ts | 站点访问门禁与站主身份是两层控制 |
| 行情批量/缓存 | app/api/quotes/route.ts、lib/market-data.ts | 报价不等待 USDT 历史图表；单代码可独立失败 |
| 历史 | app/api/history/route.ts、lib/okx.ts | USDT 可先代理监控服务，失败回退直接行情 |
| 数据类型/提醒 | lib/market.ts、lib/monitoring.ts | 价格时间与查询时间分开；失效报价不触发提醒 |
| 刷新/图表 | lib/refresh-policy.ts、lib/chart-viewport.ts | 退避和未变点数组复用 |
| 状态与自选 | lib/radar/asset-state-v2.ts、lib/radar/watchlist-state.ts | 同源纯派生；各维度窗口/失效边界见STATE_INTELLIGENCE |
| 历史包/研究 | lib/history/package.ts、lib/history/replay.ts | 有界fixture版本包、独立历史校验；无网络或计时器 |
| 本地持久化 | collector/store.mjs、collector/schema.sql、scripts/history-local.mjs | Node SQLite与固定目录；独立于monitor D1，不自动随网站部署 |
| 云端执行 | monitor/worker.mjs、monitor/schema.sql | scheduled 入口、租约和提醒代次；真实调度配置未核实 |

前台 USDT 目标 5 秒、股票 15 秒；允许后台时目标 60 秒，浏览器可能降频。
Yahoo 缓存：1d/15m 为 10 秒，其余为 240 秒；进程内缓存与在途去重，不是跨实例共享缓存。
Yahoo 与 OKX 429 遵守 Retry-After 且至少等待 60 秒；OKX 按路径记录限流、按完整请求键合并在途请求。两者仍使用各自的缓存策略，传输时限与验证见 RELIABILITY.md。
UI 文案描述云端每分钟执行；这里只确认 scheduled 处理器存在，没有验证线上 cron。
UI 视觉约束按需读取 mobile-design.md、motion-design.md；历史研究见 project-references.md。

2026-10-03日频补充：Coin Metrics Community PriceUSD/USD/1d已独立准入有限本地参考价库（五月46值、新API九月60值）；由现有loopback工作台只读查询到日频面板。上文fixture-only指分钟包/回放/研究输入，日频参考价不转换成这些输入。collector/coinmetrics-api.mjs负责固定官方来源解析，coinmetrics-archive.mjs复用schema1/有界备份，未迁移实时行情或生产D1，未启用自动采集。详见HISTORY_STAGE_A。
