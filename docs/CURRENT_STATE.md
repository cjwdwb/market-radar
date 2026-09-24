# 当前状态

当前生产：Market Radar 2.75维护发布 / Sites v27，2026-09-24 CST，源码`4f84e5cb39abe48e81643a6364339a47a3701472`，平台succeeded、环境revision3。本次Pre-2.8有限清理只删除未用Cloud导入并整理历史说明，不创建新产品版本，不移动radar-v2.75。发布标签sites-v27对应源码；记录tasks/archive/MR-PUBLISH-PRE28-CLEANUP.md。此前v26/source0a86366的产品功能与性能限制保留，完整2.7/2.8仍未完成。后续文档提交不重新部署。

以下为此前阶段记录：

以下两段为 2.7 开发与发布历史（2026-09-23 CST；本地未发布 → 后续 Sites v25 发布）；其后保留更早版本记录。

当前生产（2026-09-23 CST）：2.7 Foundation阶段成果已发布为Sites v25，实际源码`5d759a19946310deb1afefc12db5a490f4b12af0`，平台succeeded、env revision3；GitHub产品标签radar-v2.7-foundation/发布标签sites-v25对应此源码。网址与访问设置不变。自选同源状态、本机名单导出、显式宏观归档导入上线；本地采集器未变成云服务，真实DB/样例未上传。完整2.7的owner/价格历史/研究/长期存储待补。报告tasks/archive/MR-PUBLISH-FOUNDATION27.md。以下开发阶段“未发布”和旧生产条目保留历史事实，后续文档提交不代表重新部署。

最新本地2.7（2026-09-23 CST）：B0/C0基础上，B1/C1已打通美联储官方宏观元数据→本地SQLite→版本查询/导出恢复→Radar显式文件导入。真实2条九月记录；4次低频请求含2次解析失败，重跑新增0条。不是全月完整覆盖/个股资讯/历史价格回补；真实owner清单、价格来源权利、研究链路及云端保管仍待补。269Node、build/typecheck及新增五视口专项通过；最终回归/审计见docs/HISTORY_FOUNDATION.md。分支codex/mr-watchlist-information-history-27，HEAD00d7ef4，成果未提交/上传/部署，生产仍下述2.6/v24。旧QA不重开Gate。
当前生产：Market Radar 2.6已于2026-09-22发布为Sites v24，源码`8641d8193e5e2c27fb316bcaed9b977d63e1d119`，平台succeeded、环境revision3。包含双窗口、连续相对表现、Alignment、历史比较及逐项展开/底部返回精修。GitHub产品/发布标签radar-v2.6、sites-v24标记部署源码；后续文档提交不重新部署。正式网址https://market-radar-rex.swt-aether.chatgpt.site ，访问设置/密钥保持原状。发布记录tasks/archive/MR-PUBLISH-STATE26.md。以下“未提交/未部署”是此前开发验收的历史状态，不代表当前生产。线上登录后/真机未复测。

本地2.6精修：MR-STATE26-REFINE完成历史比较逐项展开、详情底部返回当前图表、关系缺失原因标注维度。相同fixture/操作，390px比较总览高度2368.5→475.75px；完整数值/窗口/来源保留。新build/typecheck、6项专项、10状态回归、9精修回归及320定点补证通过。独立审计无产品finding，1 LOW截图证据修复并VERIFY。未改领域规则/数据请求；分支codex/mr-state26-refine、未提交/上传/部署。报告tasks/archive/MR-STATE26-REFINE.md。

最新本地：2.6 State Intelligence II 约定P0/P1验证完成，未提交/上传/部署。分支codex/mr-state-intelligence-26，起点09338aa。选中资产双窗口90/180m方向与RMS、90m连续相对表现、Alignment及历史相邻窗口比较；不增加数据请求、symbol或timer。218 Node、build/typecheck、72项综合浏览器、9项精修专项及10项2.6定点复测通过；独立领域/集成审计无confirmed findings。五视口为本地Edge fixture，新UI真机与生产NOT RUN。契约docs/STATE_INTELLIGENCE.md；报告tasks/archive/MR-STATE-INTELLIGENCE-26.md。旧QA事实保留，不再作为Gate。

当前生产：Market Radar 2.5 已于2026-09-22发布为Sites v23，源码`31a11d2d5006e10edeb4907fe8a7cafb22ca6960`，平台确认succeeded，环境revision3。GitHub main已上传产品源码，`radar-v2.5`、`sites-v23`标记部署源码；后续介绍/发布记录提交不重新部署。正式网址https://market-radar-rex.swt-aether.chatgpt.site ，既有访问码和受众保持不变。发布记录见`tasks/archive/MR-PUBLISH-STATE25.md`。以下未发布/未上传文字为开发与QA阶段历史记录，不代表当前生产状态。

最新本地精修：MR-STATE25-REFINE 在2.5未提交成果上修复极小价格折线刻度归零、隐藏/恢复图表尺寸警告、初始加载误标暂停，并分层展示详情方法/来源。独立审计发现1 LOW大额窄区间刻度精度问题，已修复并VERIFY；最终99 Node、build/typecheck和9项专项通过，62项综合浏览器在该LOW修复前通过。报告见 `tasks/archive/MR-STATE25-REFINE.md`。用户明确旧未验证事项本轮不用跟进，QA-A保留历史BLOCKED事实但不阻塞推进。当前分支codex/mr-state25-refine；本轮未上传或发布，生产仍2.45/v22。

本地2.5：MR-MARKET-STATE-25 已按明确的“带QA-A缺口隔离实现”授权完成选中资产方向结构与RMS波动对比。分支 `codex/mr-market-state-25-builder`，基线8a79166、未提交diff。新测98/98 Node、build/typecheck、五视口62项浏览器通过，独立GPT两项LOW修复及复核通过；完整证据见 `tasks/archive/MR-MARKET-STATE-25.md`。连续相对状态Deferred，零新增请求/timer/依赖。候选本地验证不等于生产/真机通过；未push/merge/tag/deploy，现有生产仍为下述2.45/v22。

2.45 QA补证：2026-09-22用户明确报告iPhone16 Pro/iOS26.2正式网站第5步四项正常（用户反馈PASS），原其他五步通过记录保留；生产登录后QA-A仍BLOCKED。新独立Edge到门禁后，用户当前无法登录，未取得工作台会话，不绕过门禁。原整体证据不足结论保留。`tasks/archive/MR-245-POST-RELEASE-QA.md` 的48项本地浏览器、6项专项和3项动效测试是历史结果，不与2.5新测混淆。

当前生产：Market Radar 2.45 已于 2026-09-22 发布为 Sites v22，源码 `6804b41f5c6763cc631c9919e24e93fd6a076bbc`，平台确认 succeeded，环境 revision 3。GitHub main 已上传产品源码与介绍，产品标签 `radar-v2.45`、发布标签 `sites-v22` 标记部署源码。正式地址 https://market-radar-rex.swt-aether.chatgpt.site ，访问策略及密钥保持不变。记录见 `tasks/archive/MR-PUBLISH-VISUAL-245.md`。以下本地/未部署描述为此前阶段记录。

本地最新：2.45 Visual Experience & Motion Control 已于 2026-09-22 完成开发、浏览器验证和独立审计，分支 `codex/mr-visual-245`，尚未提交、推送或部署。统一面板/控件/数字层级，资产详情主事件优先，新增跟随系统/标准/减少动效偏好。83/83 Node tests、typecheck、build、五视口 48 项浏览器检查通过；独立审计未发现可证实的 BLOCKER/HIGH/MEDIUM。生产仍为 2.4 / Sites v21。详情与限制见 `tasks/archive/MR-VISUAL-245.md`。

Market Radar 2.4 已于 2026-09-18 发布为 Sites v21，部署源码 c618b41c1ef3ee9c3f79b8496a3bbd24462ae5f7；平台确认 succeeded，环境 revision 3。GitHub main 与 Sites 源码已上传，原网址及访问码策略保留。发布记录见 tasks/archive/MR-PUBLISH-ASSET-INTELLIGENCE.md。以下“本地/未部署”描述为此前开发阶段记录。
本地工作：2.4 Asset Intelligence Foundation 已实现统一纯函数 Context；全量 80/80 tests、typecheck、build 和五视口 36 项浏览器检查通过，独立审计未发现可证实的 BLOCKER/HIGH/MEDIUM。无新 Signal、请求或 timer。当前分支 codex/mr-asset-intelligence，HEAD db35e5c，保留此前 Provider/PRE24 未提交成果；本轮未推送、未部署。契约见 docs/ASSET_INTELLIGENCE.md，验证与限制见 tasks/archive/MR-ASSET-INTELLIGENCE.md。
Market Radar 2.3 已于 2026-09-17 发布为 Sites v20，部署源码 f96a5266d6b9b9febaab858e5de5b097e97b55a1，平台状态 succeeded，环境 revision 3。源码已推送 GitHub main 与 Sites main。产品验收见 tasks/archive/MR-RADAR-INTEGRATION.md；发布及版本标签记录见 tasks/archive/MR-PUBLISH-INTEGRATION.md。以下为历史阶段记录，其中未发布、未上传描述不代表当前状态。

GitHub 同步已完成：2.2 源码、介绍和部署记录已推送至 main；远端版本标签 milestone-v01–v07、sites-v08–v19、radar-v2.1/v2.2 均已读取核验。以下早期“上传待完成”属于历史状态，现已解除。

Market Radar 2.2 已于 2026-09-16 发布成功：Sites v19，源码 `52ebe5fbe052c24d44d648fad661573057c59f0a`，环境 revision 3。平台状态 succeeded，网址 https://market-radar-rex.swt-aether.chatgpt.site 。保留 public 与应用访问码。记录见 `tasks/archive/MR-PUBLISH-WORKFLOW.md`。以下为此前阶段记录。

Market Radar 2.1 Intelligence Layer 已于 2026-09-16 发布到 https://market-radar-rex.swt-aether.chatgpt.site 。Sites v18，源码 `44022bd41a7601f920ba68578381fcd17ddd88a1`，产品实现 `0710a7e`；平台确认 succeeded，环境 revision 3。保留 public + 应用访问码，未推送 GitHub。发布记录见 `tasks/archive/MR-PUBLISH-INTELLIGENCE.md`。

Market Radar 2.2 Coverage & Workflow 已在本地分支 `codex/mr-radar-workflow` 完成，最终实现 `81d193d`，未部署生产。新增 Watchlist coverage summary、Radar→Classic chart context、既有周期的安全映射、From Radar 返回路径和展开层 Watch/Alert actions；没有新增 signal、API 或 timer。相关审计与限制见 `tasks/archive/MR-RADAR-WORKFLOW.md`。

本地版本索引现覆盖初版到 2.2：`milestone-v01`–`milestone-v07` 为早期源码里程碑，`sites-v08`–`sites-v18` 为 Sites 发布索引，`radar-v2.1` 与 `radar-v2.2` 为产品源码标签。GitHub 同步因 TLS 错误尚未完成；此前“已同步”记录已纠正。完整说明见 `docs/VERSIONS.md` 与 `CHANGELOG.md`。

Radar 现支持基于真实同步 benchmark 的相对强弱、Engine 结构化证据、独立 high/medium/low Confidence、同资产相关信号聚合、可解释排序与 60 分钟确定性摘要。未知标的不推断 benchmark；benchmark 失败只局部关闭相对信号，不污染 Classic 健康状态。

本轮全量 Node tests 64/64、类型检查与 Vinext 构建通过。独立审计的 3 HIGH + 1 MEDIUM 已全部修复，最终复核 BLOCKER/HIGH/MEDIUM 均为 0。D1 持久事件历史和完整日/周摘要延期；原因及性能数据见 `docs/INTELLIGENCE.md` 与 `tasks/archive/MR-RADAR-INTELLIGENCE.md`。

GitHub 已整理为稳定 `main`、`sites-v08` 至 `sites-v17` 发布标签、`CHANGELOG.md` 与 `docs/VERSIONS.md` 版本索引。标签只恢复源码；v11–v13 的映射依据已有部署日志与连续提交顺序，证据等级已在版本索引注明。证据不足的 v1–v7 未补造标签。本次整理未改产品或生产环境。

前次发布：MR-PUBLISH-V17，用户明确授权后于 2026-09-15 发布成功。该次源码 `106c144055b0ce2aab9f6be2f8f8a21e05c4b2e2`，Sites v17，部署 `appgdep_6aa924e19de08191bc408cbc895fcc4b`，环境 revision 3。

正式网址：https://market-radar-rex.swt-aether.chatgpt.site 。平台返回的新域名已验证；旧 rreillyh210.chatgpt.site 地址实测 404。保留 public + 应用访问码保护，未更改运行密钥。原访问码可在新域名重新输入；旧域名 Cookie 不共享。

发布后验证：新地址跳转 /access 并返回 200；Logo 200；匿名 quotes/history/monitor 均 401 ACCESS_REQUIRED。最近 10 分钟 Worker 错误日志为空。浏览器访问码页已打开，但接口请求曾发生网络失败；进一步浏览器复测被自动审批因审批服务连接中断拒绝，改用只读 HTTP 完成入口/门禁检查。当前没有生产访问码，未验证登录后线上行情和完整交互。发布记录见 tasks/archive/MR-PUBLISH-V17.md。

此前 MR-RADAR-RELIABILITY 完成行情传输恢复、限流与请求合并、Radar 无变化状态复用及官方 Cloudflare 类型接入。源码已推送 Sites origin/main；本轮未推送 GitHub。

当前验证：构建、全项目类型检查、55 项 tests 与相关代码 lint 通过；五种视口和 17 项浏览器检查通过。真实四标的报价与 OKX 96 根历史成功返回。独立审计提出的超时边界已修复并测试，但独立审计因额度限制未完成最终复核。详细测量、命令与限制见 RELIABILITY.md；产品规则见 RADAR.md。

下次工作先读 RELIABILITY.md、RADAR.md 与归档任务卡。GitHub仓库已由用户改为公开；本轮没有修改远程可见性。

## 前一阶段记录
日期：2026-09-15；视觉升级基线：87925c4。

当前成果：完成桌面和手机行情工作台的视觉、交互与动效升级；统一设计变量与控件语言，缩短核心行情到达距离，修正图表滚动/缩放边界、动态价格轴和极小价格精度，并清理云端监控所有者邮箱的硬编码。访问码、行情来源、提醒阈值和刷新策略未改变。

验证范围：1440、768、390、320 px，以及 844×390 手机横屏；无非预期横向溢出。固定测试行情下，桌面 K 线顶部从 937.9 px 提前至 709.6 px，390 px 手机从 1092.8 px 提前至 655.0 px。普通滚轮经过图表时保持页面滚动，`Ctrl + 滚轮` 和触控手势操作图表。

项目已补充 `.env.example`、CI、README 和视觉验证说明，准备推送到用户的 GitHub 私有仓库。真实生产行情、云端 cron 和生产密钥仍需在对应部署环境验证。

---

本次任务：仅建立 Codex 协作规则、事实索引、任务模板与四个角色 Skill。
未修改产品代码、依赖、认证、数据库或发布配置；未执行部署。
已核对：package.json、README、现有 docs、API、行情/刷新模块、Worker/监控入口和测试入口。
验证：配置路径/引用和 Skill 格式检查；产品测试未运行（纯说明与工作流改动）。
部署、实际 cron、线上监控凭据与真实行情可用性：未验证。

## 已发现的上下文成本
- README 的数据源、云端能力和 Node 版本落后于实现，容易导致重复调查或错误规划。
- app/market-radar.tsx 约 49 KB，产品状态/网络/渲染集中；按符号片段读取，不为省 Token 顺手重构。
- package-lock.json 约 498 KB；vendor、build、.sites-runtime 等不是默认阅读对象。
- npm test 先构建；相关 Node 单测可减少无关执行和日志。
- 四阶段无条件全跑、完整聊天复制给每个角色会增加成本；改成任务卡和按需阶段。
没有采集 Token 使用基线，以上为可观察的成本来源，不声称已节省具体百分比。

下一步：用 PLANNER 将真实需求填入 tasks/ACTIVE.md，再按允许范围实施。
