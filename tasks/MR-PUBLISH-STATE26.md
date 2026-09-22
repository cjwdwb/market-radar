# MR-PUBLISH-STATE26 — 发布2.6及精修

2026-09-22。用户明确授权“上传部署吧”。目标：将已验证2.6+局部精修提交至cjwdwb/market-radar，发布同一源码到既有Sites项目，补齐介绍与版本索引。不增加产品功能。

## 基线与范围

分支codex/mr-state26-refine，HEAD/GitHub main重新读回均09338aa6b03affcb01262ad571212797b0590c09。全部未提交文件属于既有2.6任务与精修，保留；实际生产get_site读回v23/public，现有生产源码31a11d2。既有网址与访问策略/密钥/数据库保持不变。

允许提交既有app/components/lib/tests/doc成果；仅新增修改README、CHANGELOG、docs/VERSIONS、CURRENT_STATE及状态文档发布说明、ACTIVE、本任务/归档。outputs、.dev.vars、node_modules等忽略产物不上传。新增不可移动radar-v2.6标签；发布成功后按实际Sites版本号添加sites-vNN。普通快进push，禁止force覆盖远端更新。

## 验证与流程

先对照最终精修manifest覆盖旧2.6manifest，14个产品/测试文件hash一致；复用最终build/typecheck、精修6/状态10/精度9与320补证1、独立审计及VERIFY。218全量Node属于领域实施阶段，最终精修仅UI，领域hash不变；本轮不把历史证据写成新测试。

遵循market-planner及Sites官方open/publish/package流程，保存精确commit后部署，核对平台succeeded与URL；本机打包不可用时只走工具明确支持的remote-build fallback。不上载旧dist冒充新打包。官方临时凭据仅会话内/隐藏stdin，禁止写入Git remote/命令行/文件。

GitHub/Sites远端commit与标签读回；发布后文档提交与实际部署源码分别记录，不为更新文档再次部署。无需重跑无变更产品检查/浏览器。生产登录后与真机仍未验证，不触发真实提醒、不绕过门禁。

## 当前进度

14文件hash复核通过，GitHub main未推进。Sites源仓open在沙箱内连接失败，获准沙箱外后遇TLS握手问题；正在通过官方流程重试，不禁用证书校验。部署尚未开始。
