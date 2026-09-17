# MR-PUBLISH-INTEGRATION

状态：完成。用户明确授权上传、发布与版本整理。

## Scope

同步 2.3 源码至 GitHub/Sites，保存并部署版本，补充发布记录、版本标签和任务归档。无产品代码、依赖、行情、认证或生产密钥修改。

## Publication evidence

- 日期：2026-09-17。
- 源码：`f96a5266d6b9b9febaab858e5de5b097e97b55a1`，已推送 GitHub main 与 Sites main。
- 项目：`appgprj_6a9b9dc23584819190a31ae417863e7a`。
- Sites v20：`appgprj_6a9b9dc23584819190a31ae417863e7a~appgver_918a20666bf481918e6319f72611ae5d`。
- 部署：`appgdep_6aaba1d819fc8191ad3d51d6fbf06fb0`。
- 平台最终状态：`succeeded`，更新时间 `2026-09-17T08:18:15.942355+00:00`，环境 revision 3。
- 正式网址：https://market-radar-rex.swt-aether.chatgpt.site 。保留 public 受众与应用访问码。
- Windows 本地打包启动失败后使用平台远程构建，构建和发布均成功。
- `radar-v2.3` 与 `sites-v20` 均标记实际部署源码；后续文档整理提交不代表重新部署。

## Validation and limits

复用产品源码已完成的 70/70 Node tests、30 项浏览器检查、构建/typecheck 与独立审计复核。详见 MR-RADAR-INTEGRATION；本次仅文档与标签收尾，未重跑产品测试。平台部署成功已验证，线上登录后完整交互未复测。

收尾核对文档 diff、标签目标及 GitHub main/tag 远端引用；保留既有历史标签，不移动版本回退点。生产源版本保持 v20，未再次部署。
