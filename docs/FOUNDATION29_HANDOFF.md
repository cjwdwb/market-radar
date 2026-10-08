# 2.9 — Real Data & Research Foundation

2026-10-07 范围调整。用户明确批准 2.9 按已交付基础能力收口，3.0A 先推进解释链路；这是本日的新决定，不倒填历史完成状态。

| 能力 | 判定 / 实际边界 / 证据 |
| --- | --- |
| BTC/ETH 长期真实日频参考价 | Completed；各 1828 个 PriceUSD/USD/1d，2021-10-01 至 2026-10-02，不是分钟 OHLC；[覆盖](HISTORY_COVERAGE_EXPANSION.md) |
| 有界版本化查询、分页和覆盖 | Completed；固定版本、每页最多 31 日；[API](API_CONTRACTS.md)、[发布 v31](../tasks/archive/MR-PUBLISH-LONG-REFERENCE29.md) |
| 本地存储、一致快照、恢复基础 | Completed；[B](HISTORY_STAGE_B.md)，同机备份不等于异地长期保管 |
| Short90 / Medium180 Direction、RMS 回放基础 | Completed on fixture；不是实际分钟历史回放通过；[C](HISTORY_STAGE_C.md) |
| 固定研究协议、研究账本和结果追加机制 | Completed on isolated fixture；不代表预测有效或真实前瞻结果成熟；[C](HISTORY_STAGE_C.md) |
| 官方项目/产品及 FED 资料 | Completed within approved sources；5 源 25 条项目资料与 FED 2 条，不是完整财报/新闻；[来源](INFORMATION_SOURCES.md) |
| 来源、版本、时效与限制 | Completed within delivered scope；没有 PIT、全市场完整性或因果保证 |
| 生产发布 | Completed；现有 Sites v32 / source `4a4b7fb66ac4fc10663087b42a09e08c55804e2a`，本轮只读取平台记录，未登录验收或重新发布 |
| 分钟、小时、广泛集合、vintage、异地保管和成熟结果 | Deferred / Blocked by external source；原目标留在 [Data Track](../tasks/DATA-MINUTE-HISTORY.md) 和原 A/B/C 主台账 |

Foundation 收口与 Data Track 完成分开判定。3.0A 不受分钟缺口阻止，但不能产生依赖未取得样本的历史胜率或分钟模式结论。历史文档中的“完整 2.9 未完成”为当时范围的原记录，不删改。
