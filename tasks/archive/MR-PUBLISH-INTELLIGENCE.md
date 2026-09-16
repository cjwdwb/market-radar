# MR-PUBLISH-INTELLIGENCE

- 状态：完成；2026-09-16。用户明确授权发布 Market Radar 2.1。
- 发布源码：`44022bd41a7601f920ba68578381fcd17ddd88a1`；产品实现 `0710a7e`。
- 项目：`appgprj_6a9b9dc23584819190a31ae417863e7a`；owner，public，沿用访问码与运行环境。
- 源码同步：确认 Sites origin/main 为本地祖先，普通 push 成功；未推送 GitHub。临时凭据仅用于单命令 HTTP header，未持久保存。
- 构建：复用此前同产品源码的 64/64 tests、typecheck 和本地构建；portable profile。官方 package-site.mjs 因 Windows 无 bash 无法启动，使用平台支持的远程构建。
- 版本：18，`appgprj_6a9b9dc23584819190a31ae417863e7a~appgver_c38b8d4698108191809281884b95ecf9`。
- 部署：`appgdep_6aa9e30c985c8191a27ad2fff29a1216`；succeeded，2026-09-16T00:32:22.499805+00:00，环境 revision 3。
- 网址：https://market-radar-rex.swt-aether.chatgpt.site ，来自本次成功部署返回。
- 恢复：save/deploy 丢失响应后，通过版本列表恢复同源码版本与部署 ID，未重复发布。Git 网络连接经授权沙箱外执行成功。
- 验证边界：平台构建与发布成功已确认；按 hosting handoff 规则未额外抓取生产网址或重跑浏览器。当前无用户可见浏览器打开工具，通过链接交付。未修改访问控制、凭据、数据库或行情设置。
