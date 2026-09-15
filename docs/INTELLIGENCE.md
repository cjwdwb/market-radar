# Market Radar 2.1 — Signal Intelligence

实现日期：2026-09-15；任务：MR-RADAR-INTELLIGENCE；基线：`106799f`。

## Architecture

数据流保持单向：共享 Quote / History snapshot → raw signal engine → raw session store → `lib/radar/intelligence.ts` → Radar UI。Intelligence 是纯函数，不请求行情、不改写 raw signals、不创建 timer。Classic 继续使用原有状态和 UI。

本轮完成 Phase A–C：Relative Strength / Weakness、Engine evidence、Confidence、Clustering、稳定 ranking 与 60 分钟 deterministic summary。Phase D D1 history 和完整 Phase E 日/周 summary deferred。

## Relative Strength / Weakness

| 市场 | 资产 | Benchmark |
| --- | --- | --- |
| Crypto | BTC 以外的 USDT 资产 | BTC-USDT |
| US | 当前科技/成长个股目录 | QQQ |
| CN | A 股个股 | 000300.SS |
| HK | 港股个股 | ^HSI |

BTC、QQQ、SPY、主要指数本身不递归生成 relative signal。自定义代码按市场映射，但 source/currency/session/interval 任一不匹配即拒绝。

资产和 benchmark 使用同步完成的 K 线。窗口统一为 15 分钟：股票为 3×5m，crypto 为 1×15m。`relative delta = asset return - benchmark return`。至少需要 12 个历史对齐 relative 窗口；阈值为历史绝对 relative delta 中位数的 3 倍，并设股票 0.35%、crypto 0.60% 的噪声下限。报价时间差或最新完整 K 线差超过一个 interval、历史 gap、过期、休市、来源/币种/周期不一致都不生成。

真实只读验证：^HSI/0700.HK 为 Yahoo+HKD，QQQ/NVDA 为 Yahoo+USD，000300.SS/600519.SS 为 Yahoo+CNY；各组 quote timestamp 相差 20–25 秒或一致。验证时市场休市，因此正确退出 relative 扫描，未用旧收盘生成事件。

## Evidence and Confidence

每个新 raw signal 由 Engine 输出 `RadarSignalEvidence`：确定性 reason、指标列表、baseline、threshold、样本数、最低样本数、触发强度和 freshness。Relative 额外携带 benchmark symbol、return、quote/fetch/evidence timestamps。UI 只格式化并展示这些字段。

Confidence 与 severity 独立。三项各 1 分：数据位于 freshness 窗口前半；样本数达到最低要求的 1.5 倍；强度达到阈值 1.5 倍或有不同类型的同期 cluster signal 支持。3=high、2=medium、0–1=low。界面只显示高/中/低和三条原因，不显示伪精确百分比。旧版、缺少 evidence 的会话事件局部降级为 low；不会删除 raw history。

## Clustering, context and ranking

只聚合同资产、active、15 分钟内、方向兼容的相关类型。首版支持 Momentum Expansion、Breakout Confirmation、Selling Pressure、Relative Strength Event 和 Relative Weakness Event。每个 raw signal 最多归属一个 presentation event；resolved/expired 作为 singleton history；raw store 保持最多 120 条且内容不变。

Context 只包含 Engine 已证明的 benchmark 对比和 cluster 内原始信号，不生成新闻或情绪原因。排序是可解释字典序：active → watchlist → cluster → severity → confidence → recency；每个 event 保存 `rankingReason`。

顶部 summary 只统计最近 60 分钟 active presentation events，展示关注资产数、高优先事件数和前三条。它是当前会话派生值，不持久化、不调用 AI。

## History decision

D1 history 未实现。现有 monitor 每分钟只取轻量 quote，缺少 detector 所需历史；schema 仅有 settings/alerts/runtime，站点代理也只暴露 owner monitor 设置。持久化会同时引入 migration、server-side history budget、signal generation ownership、访客读取授权和 retention contract，风险超过本轮 MVP。当前 Recent Activity 继续来自有上限的 session raw store。

## Performance evidence

- 固定 5 个 raw signals，`buildRadarIntelligence` 连续运行 1,000 次，预热后 6 轮中位数 4.42ms（本机 Node 微基准，不代表设备 FPS）。
- 基线 `106799f` 与本轮相同 Vinext 环境比较：主 `market-radar` client chunk 710,174 → 722,110 bytes，增加 11,936 bytes / 1.68%；既有 >500KB warning 仍存在。
- 默认扫描集合最多新增 BTC-USDT、QQQ、000300.SS、^HSI 四种 benchmark，其中 BTC 已在 overview；默认配置实际新增 3 个 provider symbols。它们合入现有 crypto/stocks polling group，不新增 timer 或 detector request。benchmark 失败只关闭相关 relative signal。
- 上述结果未显示明确 render/request/bundle 瓶颈，因此按 Optimizer gate 跳过专项优化。

## Validation

确定性 tests 覆盖 relative 强/弱/同步移动、missing/stale/session/source/currency/timestamp/interval/history 拒绝；evidence provenance；confidence 高低；cluster 创建与不同资产/方向/窗口/status 非聚合；raw 唯一归属、排序、summary 与 120 条 history。

浏览器 fixture 覆盖共享 benchmark 请求、benchmark 不进入 My Radar、cluster/confidence/summary、手机 evidence 展开、原有导航/自选/提醒/慢/空/失败/存储/reduced-motion/intro。1440、768、390、320 与 844×390 无横向溢出或 pageerror。测试数据只存在于请求拦截，不进入产品。
