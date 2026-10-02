# 文档导航

从[仓库首页](../README.md)了解产品；接续开发先读[项目速览](PROJECT.md)、[当前状态](CURRENT_STATE.md)和[任务索引](../tasks/ACTIVE.md)。本文仅导航，规则与验收以专题文档为准。

## 开发、架构与协作

| 文档 | 什么时候读 |
| --- | --- |
| [PROJECT](PROJECT.md) | 环境、目录职责、开发与测试入口 |
| [ARCHITECTURE](ARCHITECTURE.md) | 前台行情、Radar/State、本地历史与独立云监控边界 |
| [API_CONTRACTS](API_CONTRACTS.md) | 行情字段、接口、时间与认证约定 |
| [RELIABILITY](RELIABILITY.md) | 缓存、时效、重试、刷新与运行可靠性 |
| [DECISIONS](DECISIONS.md) | 理解既有方案选择 |
| [DEVELOPMENT_PROVIDERS](DEVELOPMENT_PROVIDERS.md) | GPT/DS开发分工与外发边界；不是产品AI接口 |
| [AGENTS](../AGENTS.md) / [当前任务](../tasks/ACTIVE.md) | 角色流程、允许路径、待办及验收范围 |

## 产品与数据契约

| 文档 | 范围 |
| --- | --- |
| [RADAR](RADAR.md) | 检测范围、覆盖及Classic/Radar工作流 |
| [INTELLIGENCE](INTELLIGENCE.md) | Signal证据、置信度、聚合、排序和确定性摘要 |
| [ASSET_INTELLIGENCE](ASSET_INTELLIGENCE.md) | 单资产上下文、事件引用与用户跟踪边界 |
| [STATE_INTELLIGENCE](STATE_INTELLIGENCE.md) | 方向/RMS、双窗口、相对表现、Alignment及历史比较 |
| [HISTORY_FOUNDATION](HISTORY_FOUNDATION.md) | 2.7自选、有限来源、本地SQLite、采集与恢复说明 |
| [HISTORICAL_INTELLIGENCE](HISTORICAL_INTELLIGENCE.md) | 2.8 Foundation模拟历史包、独立回放、研究规则和待补条件 |
| [文件与数据索引](../data/README.md) | 可公开示例、本地原始库/备份和证据的位置与身份 |

历史库不取代实时行情；可查询不代表覆盖完整，模拟研究不代表真实预测。

## 设计与体验验证

| 文档 | 范围 |
| --- | --- |
| [mobile-design](mobile-design.md) | 手机布局、触控、安全区与导航 |
| [motion-design](motion-design.md) | 动效节奏、三档偏好与减少动态效果 |
| [VISUAL_REFINEMENT](VISUAL_REFINEMENT.md) | 视觉规则与已有前后验证 |
| [PERFORMANCE_275](PERFORMANCE_275.md) | 测量方法、导入可靠性及测试限制 |
| [project-references](project-references.md) | 已记录的设计/工程参考，不代表全部实施 |

## 发布与证据

- [CURRENT_STATE](CURRENT_STATE.md)：顶部为当前状态，后续保留阶段历史。
- [VERSIONS](VERSIONS.md)：产品标签、Sites版本、部署源码与回退点。
- [CHANGELOG](../CHANGELOG.md)：按版本整理的可见变化。
- [tasks/archive/](../tasks/archive/)：已归档任务及当时的证据；历史“未发布”不覆盖后续发布记录。
- [evidence/](evidence/)与[screenshots/](screenshots/)：精选公开摘要和截图；原始日志留在本地outputs。

281项Node及19项相关浏览器检查是2.8 Foundation发布前的本地证据。新任务应查看实际执行记录，不能用源码上传或部署成功代替生产登录后、真机或真实数据验收。
