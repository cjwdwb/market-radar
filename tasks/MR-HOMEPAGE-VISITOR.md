# MR-HOMEPAGE-VISITOR · 主页免访问码阅读入口

2026-10-23。用户明确要求从自己的 SWT Aether 主页进入市场雷达时无需验证码。已核实当前 Sites 项目 owner/public/v34，源代码 d95b2ea35afc8d767ea65f3af4a7aabcdf34a497；原生产源码在独立 checkout 打开，未混入其他聊天或 worktree 的改动。

## 范围与实现

- 新公开 GET `/from-aether` 签发单独的 `__Host-radar_visitor` HttpOnly / Secure / SameSite=Lax 会话，24小时后到期，固定303到 `/`。它是公开可分享的阅读入口，不把 Referer 当身份，不使用链接秘密。
- 签名使用独立 HMAC 域；访客 token 无法成为完整访问码会话。仍由既有服务端密钥签名，未读取、修改或输出秘密。
- 访客仅 GET/HEAD 访问工作台、生成的 JS/CSS/字体图片、图像优化、两份已公开示例及明确列出的6个市场/能力读取API。API自身输入验证继续生效。
- `/api/monitor`的GET/PUT、AI POST、全部写入与未知/未来API均保留认证。原完整会话、云监控站主身份、AI预算与生产关闭策略不变。
- 退出清理两种会话；设置按钮使用中性“退出访问”。站主登录返回 `/access` 以完成原访问码升级，避免访客登录后困在401循环。
- 允许路径：worker/access-gate.ts、app/market-radar.tsx、components/cloud-monitor.tsx、tests/visitor-access.test.mjs、本卡和相关契约/状态索引。没有依赖、数据库、模型、采集和调度改动。

## 本地验证

- 既有门禁5项+新访客6项，共11项通过；另监控和生产AI授权7项通过，覆盖原行为和权限分离。
- 新访客测试含无码签发、资源/RSC、读取白名单、未知API与写入拒绝、签名域隔离、过期/篡改/超期/轮换、缺配置关闭、固定跳转和双会话退出。
- 独立审计定位站主登录返回路径回归，已修；另18项编码路径/错误方法/混合会话检查通过，实际资源符合白名单。
- 按原package-lock用既有便携Node22.15/npm10.9.2安装；Windows直接Vinext构建与typecheck，保留原Linux脚本，不修改依赖锁。Sites安装helper在本机缺少PATH中的npm，使用项目既有Windows构建方案。
- 本地workerd 8794真实浏览器：新入口303→工作台200，HttpOnly访客cookie存在、完整cookie不存在，静态资源0失败、pageerror0；6个读取API通过原校验/返回，云监控、AI写入和未知API401，退出后恢复401。桌面/390截图存于主站 `docs/evidence/radar-entry/local-*`。
- 最后修复组件链接后需重新构建；停止临时预览以释放Windows构建目录锁。发布与线上点击结果由主站 UI-002 记录继续登记，不把本地通过当线上完成。

## 发布与回退

使用原Sites project/audience/env，源码先推送后保存/部署；不更新环境变量。回退可部署已保存的 v34；新访客cookie对旧门禁没有完整权限。未验证真实站主登录服务全流程、真实移动设备或其他浏览器。
