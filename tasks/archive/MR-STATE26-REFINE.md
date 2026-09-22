# MR-STATE26-REFINE — 本地精修完成

2026-09-22。用户授权主动检查与优化当前项目；仅本地，不上传/部署。沿用既有planner/builder/auditor；本轮不重开旧QA门禁事项。

## Baseline / preserve

HEAD09338aa，现有2.6全部未提交成果保留；新分支codex/mr-state26-refine。实际比较起点是已验证2.6工作区，不是2.5 HEAD。上轮218 Node/build/typecheck、72综合/9精修/10定点和领域/集成审计为历史依据。本轮改动前5个允许产品/测试文件快照（.before后缀，不进入TS检查）与hash见outputs/state26-refine/baseline-manifest.json；禁止回滚或覆盖其余成果。

## Findings / goal

独立只读UX盘点发现：
1. 历史比较外层打开即显示5组完整事实；手机第一组占近一屏，难跳读。上轮全方法/比较展开Context高390px=6269、320px=7207（不能把总高归因全是Transition）。先用同fixture新测Transition自身高度。
2. 返回图表仅在Context顶部，详情末尾无入口。旧locator.click会自动滚动，只证明功能，不能证明用户返回成本低。
3. Alignment缺失列表丢弃participant显示标签；暂停/离线三项原因相同，阅读无法区分。

目标：按项展开完整历史比较；详情底部可直接回当前图表；缺失原因对应维度明确。保留主事实、所有窗口/阈值/来源、默认外层折叠、native滚动、键盘及≥44px触控、手动周期和资产。不可用原因在单项折叠时仍可见。

## Scope / allowed paths

components/radar/asset-state.tsx、asset-context.tsx、radar-feed.tsx，app/radar.css，tests/browser/radar.mjs，tasks/ACTIVE.md/本任务归档、docs/CURRENT_STATE.md、docs/STATE_INTELLIGENCE.md相关说明；outputs/state26-refine证据。

每项使用原生details，不做互斥手风琴、不增加store/timer/动画库。底部按钮非fixed、复用onAsset路径，独立明确名称，避免与顶部按钮混淆。participant只是字段标签格式化，UI不计算金融事实。

不改变lib/radar领域文件、信号规则、State契约、API/provider/请求、刷新、数据库、认证、全局动效、图表几何/手势。当前计算已约0.017ms/次，无计算瓶颈证据，不做memo或算法重构。Optimizer仅按可测阅读/导航成本门槛参与本任务，不声明FPS提升。

## Execution / acceptance

先给现有loopback browser harness增加before/after专项（继承fixture安全守卫），固定NVDA/QQQ80点及同窗口五视口，记录Transition打开后高度、每项可达性、Context高度、返回操作位置、截图。before不改产品。

Builder后：外层和5子项默认折叠；每项键盘可展开、完整事实仍有、其他项不被强制关闭；折叠失效项仍见原因；标题/点击区域≥44px、无横溢；底部返回不先跳到顶部，同symbol/manual1w保持；offline三条维度标签明确。同数据前后截图/测量、pageerror和console分记。

相关验证：新增五视口专项、受影响2.6定点测试、既有精修专项；build/typecheck；纯UI无领域修改，218Node历史不冒称本轮（若有新集成风险再扩大）。独立GPT对稳定增量（baseline snapshots而非只看HEAD）与证据审计→必要FIX→VERIFY。

GPT负责规划/实现/验证/独立审计。DS0：本轮无需外发；不改Provider。生产2.5/Sitesv23不变，2.6真机/生产未测事实保留。

## 实施结果

PASS。仅4个产品文件改变：asset-state.tsx按项原生details、不可用原因保持外显、Alignment参与项标签；asset-context.tsx底部可选返回；radar-feed.tsx传原onAsset；radar.css调整这些控件。测试修改只在既有browser harness。没有领域、父组件、请求、依赖变化。

五项比较均默认折叠，互不自动关闭；所有原消息、窗口、数值、方法/source/currency仍在，用户按需展开。新增底部“返回 NVDA 图表”等入口复用原导航，非固定栏，不覆盖内容，保留symbol/手动1周。离线/暂停时三条原因分别标注短窗方向/中窗方向/短窗相对表现。

## 同条件测量与截图

本轮新测Edge149.0.4022.98 headless、本地localhost:5176；固定NVDA/QQQ各80点、同now、reduced、外层详情打开/方法关闭，只点击“前后窗口比较”一次。before直接显示全量5项，after显示5项按需展开入口。比较的是相同操作后的默认阅读成本，不声称完整展开全部内容也缩短80%。

| 视口 | before 比较区域高px | after 高px | 默认阅读高度减少 |
| --- | --- | --- | --- |
| 1440×1000 | 1581 | 426.75 | 73.0% |
| 768×1024 | 1777 | 451.25 | 74.6% |
| 390×844 | 2368.5 | 475.75 | 79.9% |
| 320×740 | 2893.5 | 500.25 | 82.7% |
| 844×390 | 1703.5 | 451.25 | 73.5% |

outputs/state26-refine/layout-comparison.json记录测量；before/after验证文件的每项numbers数组完全一致。截图outputs/state26-refine/browser/before/*-comparison.png与after/*-comparison.png（**320例外用after-narrow/narrow-comparison.png**）；after/*-return.png为底部返回。全部完整内容仍可展开；字重/字号及关键风险说明不靠缩小/隐藏换高度。

主chunk758614→759428 bytes，gzip230206→230366（+160 bytes）。outputs/state26-refine/bundle.json。无JS计算瓶颈证据，不另改算法或memo；上述是布局/操作成本，不是设备FPS测量。

## 本轮验证命令与结果

| 项目 | 状态 | 证据 |
| --- | --- | --- |
| Before五视口 | PASS | browser/before/verification.json，5布局/原始内容采样；没有提前声称新增交互通过 |
| 新精修专项 | PASS | browser/after/verification.json，6项（五视口+partial/offline），pageerror0/console0；44px、键盘焦点、5项独立展开、全数值证据相同、底部返回symbol/1周不变 |
| 320截图定点修复验证 | PASS | browser/after-narrow/verification.json，1项，pageerror0/console0；导航帧完成后定位并断言标题在视口 |
| 2.6既有定点回归 | PASS | state26-regression/verification.json，10项，pageerror0/console0；原有按项证据检查在新增子项展开后执行，没有削弱事实断言；隔离导航API增量0 |
| 精度/图表/SSR回归 | PASS | precision-regression/after/verification.json，9项，pageerror0/尺寸warning0；另1条console ERR_FAILED（suite含阻断脚本的SSR） |
| build/typecheck | PASS | build.txt/typecheck.txt；既有500KB warning仍在 |
| 领域/父派生身份 | PASS | 上轮manifest其余9文件hash一致；本轮不改State/Engine及fixtures |
| 全量218 Node/综合72 | NOT RUN | 本轮纯局部UI，领域未变；复用上轮历史，不冒称本轮重跑 |
| 生产/真机/屏幕阅读器实测 | NOT RUN | Edge视口模拟不替代真机；本轮不部署 |

命令：`node node_modules/vinext/dist/cli.js build`→`node scripts/typecheck.mjs`；browser统一`node tests/browser/radar.mjs`。PowerShell设置RADAR_PREVIEW_URL=http://localhost:5176、PLAYWRIGHT_MODULE=本机Codex runtime Playwright、RADAR_OUTPUT_DIR=outputs/state26-refine下对应目录。

精修入口RADAR_STATE26_REFINEMENT_PHASE=before/after；仅320补证加RADAR_REFINEMENT_VIEWPORT=narrow。回归分别RADAR_STATE26_ONLY=1和RADAR_REFINEMENT_PHASE=after，独立命令环境。Node检查脚本语法通过；未运行npm test/bash包装。

初次新增焦点断言误把鼠标操作后的programmatic focus当成键盘focus-visible；修正测试为先Tab进入键盘模式后focus/Enter，保持outline断言，不改产品焦点CSS掩盖问题。之后五视口真实键盘检查通过。

## 独立审计 / FIX / VERIFY

独立GPT比较5份baseline快照，检查稳定UI增量、契约、五视口/数值/返回证据；无confirmed产品缺陷。1 LOW证据finding：首轮after/narrow-comparison.png实际定位在Context顶部，不能作为比较总览截图。修复仅harness：等原导航RAF完成，再instant定位，并断言目标标题确实在视口；只重跑320定点，保留原错误截图，使用after-narrow替代。

独立Auditor目视新320截图、核对报告，VERIFY PASS，LOW关闭，无未解决confirmed findings。没有产品修复后冒用旧测；product在通过build/专项后的hash不变。Auditor未重跑测试，生产/真机未覆盖。GPT完成全部本地工作；DS实际调用0，无对外发送。

本地分支codex/mr-state26-refine，全部原2.6及本轮成果保留未提交；不push/merge/tag/deploy。现有生产仍2.5/Sitesv23。
