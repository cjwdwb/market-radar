# MR-GITHUB-ORGANIZE

- 状态：完成；2026-09-15。用户明确要求整理并上传 GitHub。
- Goal：以不改写历史的方式同步当前稳定成果，建立版本索引、变更日志和可回退标签。
- Baseline：GitHub main `7fb0eeb`，远程没有标签；该提交是本地当前历史的祖先，因此可正常快进。
- Files：README.md、CHANGELOG.md、docs/VERSIONS.md、docs/PROJECT.md、docs/CURRENT_STATE.md、tasks/ACTIVE.md 与本归档。
- Version model：`main` 为稳定主线；`sites-v08` 至 `sites-v17` 映射已识别的 Sites 发布源码。v11–v13 是根据部署日志和连续提交顺序恢复的映射，已在版本索引明确标注；证据不足的 v1–v7 未补造标签。
- Product impact：无产品代码、依赖、配置、仓库可见性或生产环境修改。文档整理不重复运行上一提交已通过的产品测试。
- Verify：`git diff --check`、文档相对链接、标签目标、远程 main 和远程 tags。最终提交及远程核对结果见 Git 历史。
