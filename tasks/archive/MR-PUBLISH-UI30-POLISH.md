# MR-PUBLISH-UI30-POLISH

## 发布结果 — 2026-10-23

**已上传并发布 Sites v36**。产品发布源码 `84511bfdf4189db7a0495e82a52727aeb72a7401`，原网址 https://market-radar-rex.swt-aether.chatgpt.site 。本卡下方为执行过程，不把此前未部署状态当作当前结果。主3.0真实AI与独立数据任务继续开放。

| 对象 | 实际结果 |
|---|---|
| GitHub | PR#10 UI、PR#11保留同期v35访客入口、PR#12修复root RSC均正常合并，无强推；最终产品main84511bf |
| 最终 CI | 39924196391 / job120316462450，Ubuntu / Node22.15，npm test内build/typecheck及701/701 Node PASS，0skip |
| Sites | v36；version `appgprj_6a9b9dc23584819190a31ae417863e7a~appgver_e7e3166afb2481918489f50b769cebae` |
| 部署 | `appgdep_6adb1ab239988191a1763fe8955c36b7`，原生succeeded，env revision3，未改秘密/绑定/平台访问策略 |
| 本地包 | `outputs/publish-ui30/site-final.tar.gz`，2,028,158bytes；SHA256 `d0cf31276022f125813fd824afbbe8f82ee7d904bfab74c1e6760528f3218a14` |
| 平台归档 | 上传解包后的tar6,768,640bytes/46files，hash `dee6d6f2cb394df22382c1039f3e7d1231c7a42eb4cd63f747c131441c2e0230`；与gzip文件hash不是同一对象 |
| Worker | SHA256 `ff286ed2e223bdd4c5576c091de278baf41721d00cf6420e54ea0d5ac5896e07`，与最终浏览器测试完全相同 |

### 验证、修复与边界

- 初始UI PR#10 CI39922261881为694/694；整合v35 PR#11 CI39923135657为700/700；两者是本轮中间候选，不冒充最终701结果。最后84511bf与受测b36a3a7 tree完全相同。
- 整合候选本地build/typecheck通过，完整Node700项=699PASS/1既有Windows符号链接权限SKIP；最终RSC修复后重新build/typecheck、13项门禁/monitor专项与2文件lint通过。最终全量由上述Ubuntu CI执行。
- 整合后五视口UI16组PASS，60张after截图和一项200%文本根字号补测，pageerror0，6条预期console错误；来源25d34ea。修复RSC不改UI，未机械重跑该全套。before仅24张配对截图，不能称60对。
- 实际访客浏览器发现VISITOR-RSC-001：原43至50次 `GET /.rsc` 401。修复后b36a3a7真实构建/模拟行情5组PASS，仅1次RSC200且750ms窗口稳定；非预期401归零。5条预期401为主动负向权限检查，pageerror0。Windows workerd仍有WSARecv退出警告，不记server clean-console。
- 访客修复只补同主页的精确GET/HEAD表示；无/坏会话、邻近RSC、写方法、monitor和模型消费保持拒绝。原公开只读入口、退出与站主登录均保留。
- 扩大检查已有main/cloud文件的lint仍5errors/5warnings；与d95b2ea逐项相同，`outputs/publish-ui30/lint-baseline-comparison.json`保留证据，本发布不顺手重构。初始UI局部lint及最终gate测试lintPASS，不宣称全仓lint通过。
- 独立GPT源码审计、RSC修复VERIFY及最终包装VERIFY均PASS。归档59项=46文件+13目录，45构建文件逐字匹配dist；hosting manifest与tracked一致，D1/R2为null，无私人资料、账本、Key、源码/测试工具或额外绑定。
- 产品模型调用0；开发DS0。未改行情算法/刷新/预算，不上传个人解释文件，网站仅提供浏览器内存阅读。无新云资源/迁移/调度。生产站主登录与真机NOT RUN，访客线上检查另记。
- 截图和原始脱敏验证位于两个工作树的ignored outputs；`ui30-browser/outputs/publish-ui30-final/ui/after/verification.json`、`visitor-before-rsc-fix/verification.json`（保留FAIL）、`visitor-fixed/verification.json`（新PASS）。不把本地fixture等同生产真实行情。

后续仅文档收尾提交，不触发第二次部署。同期v35作为历史回退点保留；未移动/新建发布标签。

### 线上只读复查 — 新测，保留局部失败

2026-10-23 08:29:05–08:29:13 UTC，新独立Edge默认会话，通过公开 `/from-aether` 进入，不用fixture/请求拦截/测试会话/旧Cookie/门禁绕过，不输入访问码、不导入私人文件、不改自选提醒。入口303→root200、历史三区/文件选择按钮、390px无溢出、11项脚本样式200、root RSC仅1次200。GET能力200/unconfigured/realProviderEnabled=false；0pageerror/0AI或monitor写请求。浏览器自动完成1次Cloudflare挑战POST，不能称整个浏览器零POST；未主动操作挑战或绕过。

实际3次history503及3条console error，结论为 **UI_AND_ACCESS_PASS_WITH_HISTORY_503**，不能宣称全部行情健康。后续本轮只读Worker日志确认在08:29:13，`BTC-USDT`、`ETH-USDT`、`SOL-USDT` 的 `range=1d` 请求分别返回503，Worker outcome=ok，非未处理崩溃。日志无上游原因，根因**未确证/仍开放**；不推断休市或据此关闭质量问题。相关API和行情取数文件相对原v34逐字不变；没有为本UI发布擅改来源/刷新或重试策略，也没有重复请求生产作压测。

证据：`ui30-browser/outputs/publish-ui30-final/production-smoke/verification.json` 与3张脱敏截图；`ui30-polish/outputs/publish-ui30/production-history-errors.json` 仅含公开symbol/range/status/时间摘要，不保存Cookie、Authorization或完整日志。代理实际访问为访客范围，站主登录后和iPhone真机仍NOT RUN。新增部署是否成功已由原生终态确认；本段独立记录线上功能及数据限制。

## Planner — 2026-10-23

用户在 UI 收口后明确要求“上传部署”。本卡授权范围为已审计 UI 候选正常 GitHub 上传、PR/CI、合并及原 Sites 更新；不包含实时模型启用、秘密/访问设置、数据采集、迁移或新功能。

基线：GitHub main 重新 fetch 为 `57674a3a2dd81d77cbd79041bec743c8ac267765`；本地候选 `c4dd8bd9f200137c7d940ed7bed113e7adff2fa6`，产品 `7fdc9a9`，工作区干净。原 Sites get_site 本轮确认 active/public/v34，原 URL https://market-radar-rex.swt-aether.chatgpt.site 。部署源码仍以原 v34 记录 `d95b2ea35afc8d767ea65f3af4a7aabcdf34a497` 为核对点。

采用当前独立 ui30-polish 工作树；其他工作树不改。保留既有 D1/R2 null、应用访问码门禁及关闭的真实 Provider。已完成 UI 产品独立 VERIFY；沿用同产品的 693PASS/1Windows权限SKIP、build/typecheck/lint、五视口与工作流证据，不机械重跑。

## 允许路径与执行

仅新增本发布卡、ACTIVE/CURRENT_STATE/版本文档的必要记录与 ignored 发布产物；无计划产品改动。若 CI/打包证明有缺陷，先记录最小修复范围并针对性验证。

1. 审核候选提交范围与忽略文件，正常 push 原候选分支，创建 PR；Ubuntu/Node22.15 CI 必须通过后合并。
2. 官方 Sites source helper 打开已有 Site，使用同一已合并源码、既有构建与 manifest 打包；凭据仅内存/隐藏 stdin，不输出/写入文件。核对归档无私人资料/账本/Key/测试/采集脚本。
3. 独立 GPT Auditor 只读复核稳定 diff / 归档与环境边界；有 confirmed finding 修复后 VERIFY。
4. 对原 public audience 保存版本并部署；等待原生终态。低频匿名入口验证不能替代生产登录后、真机或真实 Provider 验收。
5. 记录 GitHub/CI/合并 SHA、Sites 版本/部署 ID/URL、包身份与检查；归档并同步 GitHub 文档，后续文档不触发第二次部署。

Optimizer：没有新产品计算改动或实测瓶颈，跳过。开发 DS 本发布无合适独立任务，不强制调用。真实产品模型请求目标为 0。

## 当前状态

PR #10 已合并 `cf8510f9fd2c78a4ec747fb0aeef7aa3d9118318`；新 CI39922261881/job120310052685，Ubuntu/Node22.15 build/typecheck/694项全部通过。发布执行中。

## 并行生产更新接续

首次正常 Sites push 被拒绝，未强推。重新打开来源并核对发现另一个用户任务 MR-HOMEPAGE-VISITOR 已在本轮过程中发布 v35：源码 `b647c43b76fca21cc437e5d6c9a9d376aabd4407`，deployment `appgdep_6adb156294208191825ee239b0918196` 原生 succeeded/env3。其 `/from-aether` 公开只读访客入口不能被 UI 发布回退。

执行最小整合：保留该来源提交的 worker/access-gate.ts、app/market-radar.tsx、components/cloud-monitor.tsx、tests/visitor-access.test.mjs 逐字不变；保留其任务与API记录。仅解决 ACTIVE/API 两个文档冲突，合并双方有效历史。新增范围为保留已上线功能，不自行发明新的访问策略或修改环境。其他工作树不动。

整合后重新构建/typecheck/相关lint、全量Node、五视口UI与访客只读路径；独立审计复核不回退v35、不启用真实模型。再次正常PR/CI后合并同源部署。本轮最终不能沿用初始“线上仅v34”的描述。

## 发布前发现 VISITOR-RSC-001 — 最小修复

整合候选 d7a424b（与25d34ea同tree）的实际生产构建浏览器，访客进入后3秒出现43次 `GET /.rsc` 401；页面初次HTML可用但Vinext后续root RSC被误拦。此前单元测试仅覆盖 `/?_rsc=test`，不能替代实际构建路径。报告位于独立浏览器工作树 `outputs/publish-ui30-final/visitor-before-rsc-fix/verification.json`，禁止将此轮记为PASS。

按本卡允许的已复现发布缺陷修复范围，新增允许路径 worker/access-gate.ts、tests/visitor-access.test.mjs、docs/API_CONTRACTS.md。仅为已有有效visitor会话允许精确root `/.rsc` 的GET/HEAD，服务于已允许主页的同一只读表示；不允许通配RSC、POST、未知页面、无会话、站主管理或模型消费。无环境/秘密/云访问策略变动。补相邻拒绝测试、受影响lint、重新构建/typecheck、实际访客复测与独立VERIFY，最终CI覆盖全量。旧归档包作废并重新打包。
