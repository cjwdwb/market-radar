# MR-PUBLISH-ASSET-INTELLIGENCE

状态：发布成功。2026-09-18。用户明确授权“上传发布吧”，并要求继续。

## Scope and source

- 发布已验收的 Market Radar 2.4 Asset Intelligence Foundation，包含此前 PRE24 正确性修复；Provider 开发文档先独立提交为 56faa61，未纳入运行时配置或密钥。
- 产品与发布准备源码：`c618b41c1ef3ee9c3f79b8496a3bbd24462ae5f7`。普通推送 GitHub main（原 db35e5c）与 Sites main（原 f96a526）均成功；未强制推送。
- 项目：`appgprj_6a9b9dc23584819190a31ae417863e7a`。
- 保存 Sites v21：`appgprj_6a9b9dc23584819190a31ae417863e7a~appgver_60720740358881918df2732edcba910f`。
- 部署：`appgdep_6aacc37cea508191b1c5a1917e273a98`，平台终态 succeeded，`2026-09-18T04:56:43.231138+00:00`，环境 revision 3。
- Windows 本机 package-site 启动失败，使用平台远程构建；未上传过期或不同源码的构建产物。
- 复用已有 public 受众与应用访问码。未修改环境变量、密钥、数据库、访问配置或产品代码。

## Validation

复用同产品源码的全量 80/80 Node tests、typecheck/build、五视口 36 项浏览器检查与独立 AUDIT/VERIFY，详情见 MR-ASSET-INTELLIGENCE。此次仅提交、发布与文档整理，不重复执行产品 suite。不宣称已验证生产登录后完整交互或真实 provider 延迟。

本地 Git 在沙箱内无法启动 HTTPS helper；沙箱外正常推送。Sites 原生连接首次网络失败，重试恢复。临时源码凭据只用于命令级 HTTP header，不落盘、不进入 remote URL 或 Git config。

## Release completion

正式网址：https://market-radar-rex.swt-aether.chatgpt.site 。`radar-v2.4`、`sites-v21` 均标记实际部署源码 c618b41。后续发布文档整理提交不代表重新部署。开发任务归档中 NOT DEPLOYED 为当时状态；本归档记录本次后续明确授权发布结果。当前没有可用的用户浏览器打开工具，直接交付平台确认的正式链接；未以额外页面请求代替平台发布核验。
