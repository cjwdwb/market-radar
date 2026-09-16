# MR-PUBLISH-WORKFLOW

- 状态：完成，2026-09-16；用户明确授权发布 Market Radar 2.2。
- 源码：`52ebe5fbe052c24d44d648fad661573057c59f0a`；产品实现 `81d193d`。
- 项目：`appgprj_6a9b9dc23584819190a31ae417863e7a`。
- Sites v19：`appgprj_6a9b9dc23584819190a31ae417863e7a~appgver_210c3918dd248191a4934781e7f2a804`。
- 部署：`appgdep_6aaa321a814c8191b239ac5e0cad7ca1`，平台 succeeded，2026-09-16T06:11:29.949943+00:00，环境 revision 3。
- 正式网址：https://market-radar-rex.swt-aether.chatgpt.site 。保留既有 public + 应用访问码、数据库及运行环境。
- 上传：普通快进至 Sites origin/main；单次命令使用现有本机代理与 OpenSSL，未修改全局网络配置，临时凭据未落盘。
- 构建：Windows 缺 bash，使用平台远程构建；平台构建与部署成功。本地验证复用同产品源码的历史 26/26 相关测试、typecheck/build、审计复核；本次未重跑，线上完整浏览器交互未验证。
- 保存响应丢失后查询版本列表恢复 v19；未重复创建或部署版本。
- GitHub 上传仍因 TLS 失败而待完成；已纠正文档中此前误记的已同步状态。
