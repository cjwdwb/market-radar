# 架构与阅读索引
依据 87925c4 的相关实现核对；运行环境是否已配置不由代码存在推定。

浏览器 → worker/index.ts 门禁 → Vinext app router → app/api → lib/market-data.ts → OKX / Yahoo。
独立云端链路：站主登录 → app/api/monitor → MONITOR_URL → monitor/worker.mjs → D1。

2026-09-15：Classic / Radar 共用 app/market-radar.tsx 状态与请求。quotes/trends snapshot → lib/radar/engine.ts（纯检测/证据/去重/生命周期）→ raw session store → lib/radar/intelligence.ts（confidence/clustering/context/ranking/summary）→ radar-feed.tsx。Benchmark 合入已有轮询分组，不进入自选或 Classic UI；无新增 API、数据库或定时器。规则见 RADAR.md 与 INTELLIGENCE.md。

| 关注点 | 首要文件 | 边界 |
| --- | --- | --- |
| 页面/本地保存/轮询 | app/market-radar.tsx | localStorage；UI 与调度同处一个约 49 KB 文件，优先按符号定位 |
| 访问控制 | worker/access-gate.ts、worker/index.ts | 站点访问门禁与站主身份是两层控制 |
| 行情批量/缓存 | app/api/quotes/route.ts、lib/market-data.ts | 报价不等待 USDT 历史图表；单代码可独立失败 |
| 历史 | app/api/history/route.ts、lib/okx.ts | USDT 可先代理监控服务，失败回退直接行情 |
| 数据类型/提醒 | lib/market.ts、lib/monitoring.ts | 价格时间与查询时间分开；失效报价不触发提醒 |
| 刷新/图表 | lib/refresh-policy.ts、lib/chart-viewport.ts | 退避和未变点数组复用 |
| 云端执行 | monitor/worker.mjs、monitor/schema.sql | scheduled 入口、租约和提醒代次；真实调度配置未核实 |

前台 USDT 目标 5 秒、股票 15 秒；允许后台时目标 60 秒，浏览器可能降频。
Yahoo 缓存：1d/15m 为 10 秒，其余为 240 秒；进程内缓存与在途去重，不是跨实例共享缓存。
Yahoo 与 OKX 429 遵守 Retry-After 且至少等待 60 秒；OKX 按路径记录限流、按完整请求键合并在途请求。两者仍使用各自的缓存策略，传输时限与验证见 RELIABILITY.md。
UI 文案描述云端每分钟执行；这里只确认 scheduled 处理器存在，没有验证线上 cron。
UI 视觉约束按需读取 mobile-design.md、motion-design.md；历史研究见 project-references.md。
