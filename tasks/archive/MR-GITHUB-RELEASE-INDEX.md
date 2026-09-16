# MR-GITHUB-RELEASE-INDEX

状态：完成（2026-09-16）

## 目标

将 Market Radar 从初版至 2.2 的可验证源码阶段整理为 GitHub 可追溯的版本索引，并同步最新稳定源码；不触发 Sites 部署。

## 完成内容

- 建立 `milestone-v01`–`milestone-v07`，标记早期真实源码里程碑。
- 保留既有 `sites-v08`–`sites-v17`，并补充已确认的 `sites-v18`。
- 建立产品标签 `radar-v2.1`、`radar-v2.2`；后者指向 2.2 完成归档前的实现提交 `2178f23`。
- 更新 `README.md`、`CHANGELOG.md` 与 `docs/VERSIONS.md`，明确源码里程碑、产品版本和已发布 Sites 版本的区别。
- 将当前稳定分支同步至 GitHub `main`。

## 边界

- 未部署 Sites，未变更生产环境、密钥、访问配置或远程可见性。
- 早期阶段缺少 Sites 发布证据时只使用 `milestone-vNN`，不虚构部署版本。

## 验证

- Git 工作树、提交、标签目标与 GitHub `main` 同步状态在推送后复核。
