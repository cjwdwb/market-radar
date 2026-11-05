# MR-MARKET-UPSTREAM-REPAIR

## Planner — 2026-11-05

用户在v38交接后明确要求“修复”，继续处理股票429与ETH/SOL代理503。基线main/HEAD fe9f6b2，生产v38/source9710a79/env3；原工作区干净，新分支codex/mr-upstream-repair。旧23/24检查记录不修改，本次不是追认旧失败为成功。market-planner→bounded Builder→相关/集成验证→独立审计/FIX/VERIFY→已授权范围内发布；仅本项目。

目标：修复已确证的取数/代理部署缺陷；有条件时同步现有代理并低频复核。非目标：换数据源、绕限流/拒绝、增加账号/付费、改秘密/访问、数据库/定时调度、AI、金融计算/提醒或降低刷新频率。

## 确证问题及切片

1. Yahoo共享冷却竞态：A/B并发首请求，A先429并建立180秒冷却，B后ECONNRESET；marketJson第二次物理attempt未重查provider冷却，仍fetch。离线mock证明，不能断言这就是生产429根因。Builder允许lib/market-request.ts、lib/market-data.ts及定向tests：每次实际尝试前调用可选provider guard；Yahoo用原upstreamRetryAt检查。保持尝试上限、截止、取消、原费用/频率及错误语义；不跨域回退。测429发生于另一个请求中后，已启动请求的重试与新排队请求均不得再派发，正常传输重试/取消不回归。

2. 独立monitor构建仍使用四文件去import拼接，新market-request/market-history依赖没有进入构建。先做实际离线复现，再修最小构建入口：允许scripts/build-monitor.mjs、独立monitor构建/运行回归tests及必要非秘密说明；不复制lib代码，不添加依赖/新服务/数据库/部署配置猜测。优先使用现有构建依赖合法打包，产物能在真实workerd执行，错误与成功身份遵循同一lib契约。不因此默认远端正在运行该产物。

两个Builder独立worktree无重叠路径；ACTIVE协调者单写。不得扩大为新代理框架或整站重构。接口先固定后整合，独立Auditor审计最终稳定diff。

## 真实权限与诊断

Sites原站点已确认v38/public/active。配置只核对原MONITOR_URL指向本项目既有Cloudflare Worker；MONITOR_TOKEN由平台隐藏，不读取其他项目秘密，不输出/写入凭据。当前未发现Cloudflare专用环境凭据；可用现有官方CLI检查授权状态，核对实际Worker与资源后才讨论部署，不新建/改绑定或调度。普通Sites发布不能替代独立Worker更新。缺少管理会话则只阻塞远端更新，继续本地修复。

本次线上诊断先读日志。若需取数，只在上一明确Retry-After已过后，对同一个原入口做新低频观察；不因失败换身份/地址。冻结最多10个外层非静态请求、1MiB行情正文、60秒、每资产一次，无自动重试。入口/重定向计数、cookie仅内存；403/429/明确拒绝停止该来源。本批与旧生产记录分开，未运行不预填PASS；不对生产注入fixture或触发监控/通知/写入。

## 验证与交付

先受影响Node与真实monitor构建/隔离workerd，再合并稳定版本build/typecheck/fullNode、相关Worker与浏览器；旧771项不是新测。新Node/依赖未引入。性能只验证请求次数与原截止，没有测量瓶颈不进入Optimizer。审计检查取消/共享冷却/重试上限、构建依赖闭合、鉴权和旧业务零变更。

分开报告：源码修复、Sites发布、独立monitor是否更新、真实股票/ETH/SOL结果。无远端权限或来源仍拒绝保持BLOCKED，不宣称全部恢复。不将代码可运行代替生产实际成功。开发DS/产品模型默认0，本次不新增外发。
