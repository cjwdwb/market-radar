# 当前任务

## MR-GITHUB-RELEASE-INDEX

- 目标：将当前 2.2 本地版本同步到 GitHub `main`，并为全部可可靠定位的产品里程碑建立清晰标签和公开介绍。
- 基线：`2178f23`；保留已有 `sites-v08`–`sites-v17` 不移动。
- 标签：早期源码使用 `milestone-v01`–`milestone-v07`，2.1/2.2 使用 `radar-v2.1`/`radar-v2.2`；它们不是 Sites 发布声明。
- 文档：更新 README、CHANGELOG、docs/VERSIONS.md，记录每一阶段、版本证据、当前状态和使用路径。
- 范围：GitHub 提交、标签和推送；不部署 Sites、不修改生产环境、密钥或访问配置。
