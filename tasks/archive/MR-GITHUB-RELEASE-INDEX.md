# MR-GITHUB-RELEASE-INDEX

状态：完成。GitHub main 已推送至包含 2.2 发布记录的 `be13711`，并通过 ls-remote 核验。此前网络中断时部分 annotated tags 实际已创建；本次确认它们的目标提交与本地里程碑一致，保留远端标签，补充 sites-v19。

## 目标

将 Market Radar 从初版至 2.2 的可验证源码阶段整理为 GitHub 可追溯的版本索引，并同步最新稳定源码；不触发 Sites 部署。

## 完成内容

- 建立 `milestone-v01`–`milestone-v07`，标记早期真实源码里程碑。
- 保留既有 `sites-v08`–`sites-v17`，并补充已确认的 `sites-v18`。
- 建立产品标签 `radar-v2.1`、`radar-v2.2`；后者指向 2.2 完成归档前的实现提交 `2178f23`。
- 更新 `README.md`、`CHANGELOG.md` 与 `docs/VERSIONS.md`，明确源码里程碑、产品版本和已发布 Sites 版本的区别。
- 已完成：同步最新稳定源码与介绍，核验 milestone-v01–v07、sites-v08–v19、radar-v2.1/v2.2 的远端引用。

## 边界

- 未部署 Sites，未变更生产环境、密钥、访问配置或远程可见性。
- 早期阶段缺少 Sites 发布证据时只使用 `milestone-vNN`，不虚构部署版本。

## 验证

- Git 工作树、提交、标签目标与 GitHub `main` 同步状态在推送后复核。
