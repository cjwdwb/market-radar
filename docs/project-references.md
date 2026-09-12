# GitHub research applied to Market Radar

Reviewed 2026-09-12. These are implementation references; this update does not install or copy the projects below.

- [Tucsky/aggr](https://github.com/Tucsky/aggr): crypto trade aggregation, with exchange work separated from UI delivery. We separate lightweight quotes, stock batches and history requests so slow histories do not hold current prices.
- [TradingView Lightweight Charts](https://github.com/tradingview/lightweight-charts): financial charting with separate full-data and last-bar update APIs. We retain the existing chart controls and avoid recalculating charts for unrelated quote changes; a full Canvas-library migration is not part of this update.
- [TanStack Query](https://github.com/TanStack/query), especially [important defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults): cached data, background refresh, structural sharing and exponential backoff. We reuse unchanged point arrays, retain previously viewed histories, prevent overlapping batches and cap failed-batch retry delays at 60 seconds.
- [Perspective](https://github.com/perspective-dev/perspective): incremental streaming analytics and virtualized grids. Its large-dataset engine is unnecessary for this site's maximum 20 watchlist entries; we keep this as a future scaling reference.
- [OpenBB](https://github.com/OpenBB-finance/OpenBB): broad financial data platform. Useful provider architecture reference; no new feed, trading capability or data license is implied.

Polling targets: USDT quotes 5 seconds, stocks 15 seconds while visible; 15-minute chart refresh 15 seconds; background quotes 60 seconds when enabled. Polling intervals are not exchange delivery latency. Slow requests do not overlap and failures back off. Price timestamps and error states remain visible, and failed or stale quotes remain ineligible for alerts.
