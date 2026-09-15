# API 契约索引
基线 87925c4；修改接口时同时核对这里指向的实现和调用方。下表是现状摘要，不是新协议。

| 接口 | 输入 | 响应/失败 |
| --- | --- | --- |
| GET /api/quotes | symbols 逗号分隔，去重后 1–28 个，符合 VALID_SYMBOL | {results: QuoteResult[], fetchedAt}；无效 400；结果内可有单代码 error |
| GET /api/history | symbol；range 默认 1d，可为 15m/1d/1w/1m/3m | {symbol,range,points,currency,timezone,source,fetchedAt}；无效 400，取数失败 503 |
| GET /api/monitor | 站主身份及服务端监控配置 | 代理云端状态；身份失败 401，未配置/连接失败 503 |
| PUT /api/monitor | 同源；JSON 设置，正文最多 30000 字符 | 转发云端状态/状态码；来源失败 403，过大 413 |
| POST /api/access、/api/access/logout | 门禁表单，细节见 worker/access-gate.ts | 设置/清除访问会话，返回重定向 |

- 所有 app API 还受 worker 门禁影响；不把报价接口当作无认证公开端点。
- Quote、QuoteResult、Point、PriceAlert 的唯一类型定义在 lib/market.ts，避免复制整套字段。
- 时间戳为毫秒；保留 timestamp 与 fetchedAt 的区别、nullable 数值、source、timezone、session。
- USDT 为 OKX 滚动 24 小时涨跌；Yahoo 相对前收盘价。不得在归一化时混为同一口径。
- 成功行情响应使用 no-store；不修改错误码或将局部失败静默变成零价格。

## 独立 monitor 服务
实现和校验：monitor/worker.mjs 的 validConfig、status、fetch。
服务端 Bearer MONITOR_TOKEN 鉴权；不向浏览器泄露 token。
GET 状态；GET /history；POST /run 手动执行；PUT 设置。站点代理仅暴露 GET/PUT。
PUT：enabled 布尔、watchlist 最多 20、alerts 最多 20；提醒 id 唯一，目标价和 createdAt 为正有限数。
状态含 enabled、watchlist、updatedAt、lastStarted、lastFinished、report、alerts；完整约束按实现核对。
存储代次由 createdAt 驱动，防止旧设置覆盖新代次/重复触发；修改需覆盖 monitor 测试。

