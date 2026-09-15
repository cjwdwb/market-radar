# MR-GITHUB-ORGANIZE

- 状态：完成；2026-09-15。用户明确要求整理并上传 GitHub。
- Goal：以不改写历史的方式同步当前稳定成果，建立版本索引、变更日志和可回退标签。
- Baseline：GitHub main `7fb0eeb`，远程没有标签；该提交是本地当前历史的祖先，因此可正常快进。
- Files：README.md、CHANGELOG.md、docs/VERSIONS.md、docs/PROJECT.md、docs/CURRENT_STATE.md、tasks/ACTIVE.md 与本归档。
- Version model：`main` 为稳定主线；`sites-v08` 至 `sites-v17` 映射已识别的 Sites 发布源码。v11–v13 是根据部署日志和连续提交顺序恢复的映射，已在版本索引明确标注；证据不足的 v1–v7 未补造标签。
- Product impact：无产品代码、依赖、配置、仓库可见性或生产环境修改。文档整理不重复运行上一提交已通过的产品测试。
- Verify：`git diff --check` 和文档相对链接通过。GitHub main 正常快进；远程 `ls-remote` 复核 main 与 `sites-v08`–`sites-v17` 的标签对象、解引用提交均和本地一致。首次批量 push 返回“标签已存在”，复核确认服务端已完整创建全部标签，因此未覆盖或重推。
- Releases：Git 标签与版本文档已完成。GitHub Release API 连续两次 EOF，未创建独立 Release 页面；这不影响 main、标签或源码下载。
