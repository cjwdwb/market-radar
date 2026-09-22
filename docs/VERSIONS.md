# 版本与回退索引

待发布：Radar 2.7 Foundation（B0/C0/B1/C1阶段成果），自选状态/本机导出/离线宏观时间线与本地归档工具。完整2.7、价格回补、研究和云采集未完成；将采用radar-v2.7-foundation里程碑，实际Sites版本及源码在成功后填写。发布卡tasks/MR-PUBLISH-FOUNDATION27.md。

当前生产：Radar 2.6 State Intelligence II，2026-09-22发布为Sites v24，源码`8641d8193e5e2c27fb316bcaed9b977d63e1d119`，平台终态succeeded。产品标签`radar-v2.6`和发布标签`sites-v24`对应同一源码；后续说明文档提交不代表重新部署。包含双窗口、连续Short Relative、Alignment、历史窗口比较及详情精修。产品验收见 `tasks/archive/MR-STATE-INTELLIGENCE-26.md`、`tasks/archive/MR-STATE26-REFINE.md`；发布记录见`tasks/archive/MR-PUBLISH-STATE26.md`。

上一生产：Radar 2.5 Market State Intelligence，2026-09-22发布为Sites v23，源码`31a11d2d5006e10edeb4907fe8a7cafb22ca6960`，平台终态succeeded。产品标签`radar-v2.5`、发布标签`sites-v23`对应同一源码；后续文档提交不代表重新部署。包含选中资产方向结构/RMS波动对比及图表/详情精修，验收见 `tasks/archive/MR-MARKET-STATE-25.md`、`tasks/archive/MR-STATE25-REFINE.md`；发布记录 `tasks/archive/MR-PUBLISH-STATE25.md`。

上一生产：Radar 2.45 Visual Experience & Motion Control，2026-09-22 发布为 Sites v22，源码 `6804b41f5c6763cc631c9919e24e93fd6a076bbc`，平台终态 succeeded。产品标签 `radar-v2.45`、发布标签 `sites-v22` 均对应此部署源码；后续发布文档提交不代表重新部署。开发验收见 `tasks/archive/MR-VISUAL-245.md`，发布记录见 `tasks/archive/MR-PUBLISH-VISUAL-245.md`。

历史生产：Radar 2.4（Asset Intelligence Foundation），2026-09-18 发布为 Sites v21，部署源码 `c618b41`，平台确认 succeeded。产品实现与验收见 `tasks/archive/MR-ASSET-INTELLIGENCE.md`，发布证据见 `tasks/archive/MR-PUBLISH-ASSET-INTELLIGENCE.md`。

此索引把可确认的 Sites 发布号映射到 Git 提交。标签采用 `sites-vNN`，避免与未来语义化版本混淆。标签只标识源码回退点；生产环境的密钥、数据库和访问策略不包含在 Git 中。

为让项目从最初版本开始都能被准确定位，早期未保留 Sites 发布证据的源码阶段采用 `milestone-vNN` 标签；Radar 2.x 采用 `radar-v2.x` 产品标签。两类标签都只标记 Git 源码，不代表曾部署到生产。

| 产品里程碑 | Git 标签 | 源码提交 | 主要内容 | 发布声明 |
| --- | --- | --- | --- | --- |
| 初版 | `milestone-v01` | `679511d` | 实时行情与本机价格提醒 | 源码里程碑 |
| v02 | `milestone-v02` | `8be3aa9` | 15 秒刷新、缓存和退避 | 源码里程碑 |
| v03 | `milestone-v03` | `fcc7fd8` | 市场工作台与后台运行策略 | 源码里程碑 |
| v04 | `milestone-v04` | `d168fe2` | OKX 15 分钟 K 线、量能与云端监控 | 源码里程碑 |
| v05 | `milestone-v05` | `c5f2e5f` | Radar 终端视觉与 K 线韧性 | 源码里程碑 |
| v06 | `milestone-v06` | `5f9123a` | 图表指标、缩放与快速标的导航 | 源码里程碑 |
| v07 | `milestone-v07` | `7aa3e6c` | 访问码与签名访问会话 | 源码里程碑 |
| Radar 2.1 | `radar-v2.1` | `ee16706` | Relative、Evidence、Confidence、Cluster 和摘要 | Sites v18 已发布 |
| Radar 2.2 | `radar-v2.2` | `2178f23` | Coverage 与 Radar→Classic 工作流 | 后续作为 Sites v19 发布 |
| Radar 2.3 | `radar-v2.3` | `f96a526` | Classic ⇄ Radar 同资产上下文、实时事件引用与共享提醒 | Sites v20 已发布 |
| Radar 2.4 | `radar-v2.4` | `c618b41` | 共享资产情报、覆盖/可用性、事件关系与相对证据；PRE24 正确性修复 | Sites v21 已发布 |
| Radar 2.45 | `radar-v2.45` | `6804b41` | 视觉层级与跟随系统/标准/减少动效偏好 | Sites v22 已发布 |
| Radar 2.5 | `radar-v2.5` | `31a11d2` | 当前资产方向结构/RMS状态、证据与失效解释；图表/详情精修 | Sites v23 已发布 |
| Radar 2.6 | `radar-v2.6` | `8641d81` | 双窗口、同步Relative、Alignment、历史比较与详情精修 | Sites v24 已发布 |

| Sites 版本 | Git 标签 | 源码提交 | 主要内容 | 证据 |
| --- | --- | --- | --- | --- |
| 24 | `sites-v24` | `8641d81` | State Intelligence II + detail refinement | MR-PUBLISH-STATE26；平台 succeeded |
| 23 | `sites-v23` | `31a11d2` | Market State Intelligence | MR-PUBLISH-STATE25；平台 succeeded |
| 22 | `sites-v22` | `6804b41` | Visual Experience & Motion Control | MR-PUBLISH-VISUAL-245；平台 succeeded |
| 21 | `sites-v21` | `c618b41` | Asset Intelligence Foundation | MR-PUBLISH-ASSET-INTELLIGENCE；平台 succeeded |
| 20 | `sites-v20` | `f96a526` | Classic × Radar Deep Integration | MR-PUBLISH-INTEGRATION；平台 succeeded |
| 19 | `sites-v19` | `52ebe5f` | Radar 2.2 Coverage 与事件工作流 | MR-PUBLISH-WORKFLOW；平台 succeeded |
| 18 | `sites-v18` | `ee16706` | Signal Intelligence：Relative、Evidence、Confidence、Cluster | MR-PUBLISH-INTELLIGENCE 任务归档与平台成功状态 |
| 17 | `sites-v17` | `106c144` | Classic + Radar、行情可靠性与状态复用 | Sites v17 发布记录及任务归档 |
| 16 | `sites-v16` | `87925c4` | 精细视觉、响应式布局与手机品牌图标 | `MR-MOBILE-VIEWPORT` 明确记录 |
| 15 | `sites-v15` | `fa2c4f6` | 帧率优化、价格脉冲与微交互 | 发布日志明确记录 |
| 14 | `sites-v14` | `5f2dae0` | 动效系统、图表手势与异常退出兜底 | 发布日志明确记录完整 SHA |
| 13 | `sites-v13` | `7d386f9` | 导航锚点跟踪与开场兜底 | 根据连续发布日志和提交顺序恢复 |
| 12 | `sites-v12` | `142895a` | 品牌开场与统一动效 | 根据连续发布日志和提交顺序恢复 |
| 11 | `sites-v11` | `9aec983` | K 线缩放、拖动和触控 | 发布日志提及 v11 实际手势验证；按提交恢复 |
| 10 | `sites-v10` | `d7fa192` | 请求拆分、缓存、结构共享和退避 | 发布日志与连续提交内容对应 |
| 9 | `sites-v09` | `bf1e4e4` | 低饱和涨跌色 | 发布日志与提交内容对应 |
| 8 | `sites-v08` | `d068473` | 黑白终端与定制标识 | 发布日志与提交内容对应 |

v11–v13 的 Sites 版本列表接口在整理时暂时不可用，因此表中明确标记为从已有部署日志和线性提交顺序恢复；未声称拥有平台原始版本记录。v8–v10 的日志描述明确，但没有保存平台 version ID。v14、v15、v16、v17 证据最完整。

## 分支约定

- `main`：GitHub 默认稳定分支，包含当前文档和下一次发布准备。
- `codex/*`：开发工作分支；完成验证后以快进或普通 PR 合入 `main`。
- `sites-vNN`：不可移动的已发布源码标签。不要强制更新已有标签；修复后发布应建立新编号。
- `milestone-vNN`、`radar-v2.x`：不可移动的源码回退点；不能据此推断生产环境、访问配置或数据状态。

## 回退前检查

1. 先查本表和对应标签：`git show sites-v17`。
2. 回退只恢复源码，不会恢复 Sites 环境变量、D1 数据或访问策略。
3. v7 及更早版本没有当前应用层访问码。网站处于 `public` 时，不得直接回退到未验证的早期提交。
4. 发布前运行构建、类型检查和测试，并确认生产环境仍配置 `ACCESS_CODE_HASH` 与 `ACCESS_SESSION_SECRET`。

## 文档索引

- [项目与本地运行](../README.md)
- [架构](ARCHITECTURE.md)
- [API 契约](API_CONTRACTS.md)
- [Classic + Radar](RADAR.md)
- [行情可靠性](RELIABILITY.md)
- [视觉升级](VISUAL_REFINEMENT.md)
- [当前状态](CURRENT_STATE.md)
