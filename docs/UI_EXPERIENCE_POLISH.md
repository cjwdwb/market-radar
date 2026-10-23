# Market Radar 3.0 UI 与交互收口

2026-10-23，任务 MR-30-UI-EXPERIENCE-POLISH。**本地候选完成并经独立 GPT VERIFY；未上传、未合并、未部署。** 主 3.0、实时 AI 和历史数据任务仍开放。

## 基线与实际对象

| 对象 | 本轮核对 / 验证 |
|---|---|
| main / 改动基线 | `57674a3a2dd81d77cbd79041bec743c8ac267765`，干净基线建立独立 `ui30-polish` 工作树 |
| main CI | `39913505302` success，重新查阅；属于基线历史执行，不是本候选 CI |
| 现有生产 | Sites v34，源码 `d95b2ea35afc8d767ea65f3af4a7aabcdf34a497`；平台记录本轮核对，生产登录后 NOT RUN |
| 最终产品 | `7fdc9a9`；本分支 `codex/mr30-ui-experience-polish` 后续仅测试 / 文档收尾 |
| 最终截图执行 | 浏览器工作树 `cf4b154448d52fb6e9cd0d1300428a05e67a626a`；相对最终产品只有测试差异，测试已 cherry-pick 到主候选 |
| 环境 | Windows / Node 24.19.0 / Edge 149.0.4022.98；loopback Miniflare 生产构建，无远程绑定，外部网络拒绝 |

其他 C1/C2、ai30b、个人服务和数据工作树均保留。未读取个人解释文件、正式预算库、Key 或私人浏览器会话。

## 实际入口与变化

| 基线问题 | 修改 / 操作证据 | 配对截图前缀 | 结果 |
|---|---|---|---|
| 宣传标题与摘要推迟主要事件出现 | 缩短 Radar 顶部，重点列表按需展开；筛选、计数、排序不变 | `radar-current`、`radar-filter` | PASS |
| 私有解释 A/B/C 平铺重复 | 默认主要观察、分歧和限制；程序摘要 / 模型选择 / 最终呈现对照折叠 | `private-collapsed`、`private-expanded` | PASS |
| 一句多个同名依据按钮 | 单一“查看依据 · N”打开完整命名列表；定位所有祖先折叠、聚焦、返回原触发点 | `personal-success-expanded`、`private-expanded`；实际点击及返回断言 | PASS |
| 价格、文件、研究混在长工作区 | Radar → 历史工作区 → 历史价格 / 已保存解释 / 回放与研究；首次按需挂载，切换保留本页已接受结果 | `personal-empty`、`history-simulation` | PASS |
| 文件成功后仍有冗长说明、双时区 | “选择解释文件” / “更换文件”，默认 UTC；保留文件声明、历史、未认证和重要限制 | `personal-success-collapsed`、`personal-error-retained` | PASS |
| 尚未确认能力时入口含混 | 明确 unknown / fixture / private / unconfigured；用户首次打开才只读发现能力，关闭模式不显示必败生成主按钮 | 最终 capability 行为检查 | PASS |

程序不新增金融摘要，不修改固定事实原文、算法、精度、阈值、事件次序或生产保护。个人文件格式仍仅支持既定 BTC 协议与 64KiB 上限。日频查询仍不支持 Short90m / Medium180m / forward30m。历史事件的本机 7 天 / 120 条、只记录运行期间、不跨设备同步限制保留。

实际修改：

- `components/radar/radar-feed.tsx`、`app/radar.css`：Radar 层级、中文标签、筛选提示、44px 添加按钮、历史局部导航样式。
- `components/radar/ai-interpretation.tsx`、`app/ai.css`、`components/radar/evidence-navigation.ts`：三层阅读、完整披露、命名引用及精确定位 / 返回。
- `components/radar/use-interpretation.ts`：独立只读 capability 发现与去重；原 generate 仍重新校验服务端能力，不增加自动 POST。
- `components/radar/history-workspace.tsx`、`personal-history.tsx`、`published-reference-history.tsx`、`reference-history.tsx`：内存状态所有权、分区隐藏与请求失效、文件选择入口。后两个组件只增加 active 生命周期取消边界，已接受查询保留。
- 相关 Node / 现有浏览器 harness 测试及任务文档。未改 `lib` 领域规则、parser、Worker 认证、模型服务、账本或依赖。

## 截图与可核对测量

本工作树 `outputs/ui-polish/before/` 保存原 24 张桌面 / 手机基线；`after/` 保存最终五视口 60 张截图，以及 320px 文本根字号补图。均为**非私人合成样例**，不是真实市场解释证据。详细索引见 [本地截图索引](../outputs/ui-polish/screenshot-index.md)。这些文件在 Git 忽略的 outputs 下，不进入网站构建。

配对运行配置相同：1440×1000 / 390×844、默认浏览器上下文与缩放、应用 reduced / 系统 reduce；固定时间 `1789372800000`；BTC-USDT / 1 周；同一市场、privateInterpretationFixture、personalHistoryFixture 和 900 根 historyFixture。最终运行 DPR 实测为 1；基线未保存 runtime DPR / visualViewport.scale，只能依据相同默认上下文推定，不补写为旧实测。各截图的展开状态、来源和实测几何记录在同目录 verification.json。最终额外覆盖 768×1024、320×740、844×390；不把只有后图的视口当成配对比较。

| 实测区域高度（CSS px） | 桌面前 → 后 | 手机前 → 后 | 解释 |
|---|---|---|---|
| 私有解释默认层 | 1006.3 → 764.0 | 1258.5 → 811.6 | 折叠重复对照，主要观察 / 重要限制仍可读 |
| 个人文件空态 | 198.4 → 111.6 | 246.0 → 159.2 | 简化选择说明 |
| Radar 区域 | 1668.0 → 1528.5 | 3674.2 → 3554.2 | 减少顶部占位，事件更早出现 |
| 个人文件成功默认层 | 705.8 → 837.5 | 904.1 → 983.1 | 重要限制改为默认可见，诚实接受高度增加 |

这是 DOM 几何测量，不是阅读效率研究或 FPS 结论。核对依据由重复同名按钮改为“展开引用列表 → 选择具体依据 → 返回解释”，多一个明确选择步骤换取引用可区分性，未声称减少所有点击。

最终已采样区域：无横向溢出；关键独立控件最小 44px；实测纯色背景文字最小对比度 6.63:1，未发现低于对应 4.5:1 / 大字 3:1 的样本。测量范围是截图所涉渲染文本 / 背景和控件，不是整站无障碍认证，不包含渐变像素逐点采样。320px 下 CSS 根字号 200% 补查无溢出，但固定 px 文本可能不随其变化；**原生浏览器缩放、完整文本放大矩阵 NOT RUN**。

## 生命周期、网络与隐私

- HistoryWorkspace 持有查询草稿、已接受归档、分页和本地会话；PersonalHistory 持有文件结果 / 读取代次 / 现有超时；日频组件保留自己的目录 / 结果。分区本地状态不持久化。隐藏面板不可聚焦，不因切换发起新请求。
- 文件慢读 A → B、取消 / 清除 → A 晚到、8 秒超时、空选择、同文件重选、隐藏读完 / 返回、错误保留旧结果、保存复核失败清空、刷新失去文件均经新旧浏览器路径验证。未伪称内存安全擦除。
- 已接受文件跨分区不丢失；旧结果 / 旧资产 / 原 asOf 明确。证据目标绑定组件、Context / catalog / request；替换结果重建局部实例，失效返回落到本结果标题。未将私人输入存入 URL 或全局 store。
- 首次明确打开解释：新增最多 1 次 capability GET；已知模式反复开关不重复探测。模拟网络失败后用户手动重试为第 2 次 GET。生成仍按既有动作重新校验；开面板、行情更新、切资产均不自动调用模型。
- 文件动作探针覆盖 fetch / XHR / beacon / WebSocket / IndexedDB；网络与相关持久写入均为空，localStorage / sessionStorage 未出现合成文件身份。没有日志 / URL 外发文件标记。原行情轮询、事件存储和动效设置保持。
- 新旧 fixture/private 解释测试含**本地 mock POST**，不是供应商调用；外部 Provider 在浏览器和 Miniflare 两层阻断。**真实产品模型 0 请求，正式预算库未打开。**
- 原公开日频目录 / 查询仍为明确加载；初次目录 + BTC + ETH 共 3 次本地只读 HTTP，分页为有界原路径。本轮使用仓库已发布 Coin Metrics 数据，没有新采集 / Provider 请求。

## 本轮验证与命令

没有执行 `npm test` 包装命令；Windows 下按现有脚本依赖顺序运行等价分项，并按候选代码变更重建；未额外再执行等价包装流程。

| 验证 | 新测结果 | 证据（outputs/ui-polish/） |
|---|---|---|
| 受影响 Node | 37/37 PASS | 4 个相关文件；最终全量也再次覆盖 |
| 全量 Node | 694 项：693 PASS / 0 FAIL / 1 SKIP | `final-node.log`；SKIP 为 Windows 文件 symlink 创建权限，junction 单测通过 |
| build | PASS，既有大 chunk warning 保留 | `final-build.log` |
| typecheck | PASS，退出码 0 | `final-typecheck.log` |
| 受影响 lint | PASS，退出码 0，无诊断 | `final-lint.log` |
| 最终 UI 五视口 | 16 组 PASS，60 张后图，其中 24 张有配对基线；另 1 张文本根字号补图 | `after/verification.json` |
| 原 fixture AI / 私有 AI | 6 + 6 组 PASS；取消、失败保留、共享结果 / 周期、持有请求期间行情刷新和拖图 | `legacy-fixture/`、`legacy-private/` |
| 个人文件 / 原模拟历史 | 16 组 PASS，10 个视口场景与 3 档动效 | `legacy-personal/` |
| 本机历史事件 | 9 组 PASS，分页 / 筛选 / 存储失败 / 返回图表 | `legacy-events/` |
| Classic/Radar 集成与动效 | 48 组 PASS，包括运行中取消真实 CSS 价格光晕、存储失败、暂停 / 离线 / 旧数据 | `integration-motion/` |
| 已发布日频本地回归 | 15 组 PASS，5 视口、固定版本跨年 / 闰日分页、503/409 保留身份、3 档动效 | `published-daily/` |
| 独立 GPT 审计 | VERIFY PASS；两项确认 finding 已修，见下 | 稳定产品 7fdc9a9 + 最终浏览器 cf4b154 |
| 候选远端 CI / 生产登录 / 真机 / FPS / 内存 profiling | NOT RUN | 未 push；未用历史记录或桌面视口替代 |

实际执行入口：

```powershell
node node_modules/vinext/dist/cli.js build
node scripts/typecheck.mjs
node node_modules/eslint/bin/eslint.js components/radar/ai-interpretation.tsx components/radar/evidence-navigation.ts components/radar/history-workspace.tsx components/radar/personal-history.tsx components/radar/published-reference-history.tsx components/radar/radar-feed.tsx components/radar/reference-history.tsx components/radar/use-interpretation.ts
node --experimental-strip-types --import ./tests/register-types.mjs --test tests/*.test.mjs
```

浏览器统一入口 `node --experimental-strip-types --import ./tests/register-types.mjs tests/browser/radar.mjs`，`RADAR_SYNTHETIC_AUTH=1`，Playwright 模块使用本机已安装路径，输出分目录。分别执行 `RADAR_UI_POLISH=before/after`、`RADAR_PERSONAL_WEB=1`、`RADAR_AI30B_PRIVATE=1`、`RADAR_AI30_ONLY=1`、`RADAR_EVENT_HISTORY_ONLY=1`、`RADAR_INTEGRATION=1` + `RADAR_MOTION=1`、`RADAR_PUBLISHED_REFERENCE_ONLY=1` + `RADAR_PUBLISHED_LONG=1`。需要的本地生产 runtime 使用现有 `tests/performance/server.mjs`；fixture AI runtime 仅测试时 `RADAR_AI_FIXTURE=1`。从未指定私人文件环境变量或生产 URL。

所有上述浏览器报告 pageerror 为空；**不等于控制台全无错误**：最终 UI 保留 5 次故意失败 503 + 1 次重试网络失败；private / events 各 5 次注入 503；日频 405/503/409 各一次；integration-motion 有 14 次模拟 monitor 401、9 次故意离线 / 阻断脚本 ERR_FAILED、4 次失败场景 503。fixture / personal 无 console warning。早期旧选择器失败日志与复现证据保留，不改写成历史通过。

没有测得需要改性能架构的瓶颈，未进入 Optimizer。受控暂停 polling 的导航实验新增 API 为 0；这不等于生产没有轮询。fixture 等待时的交互回归只证明可操作，不证明高刷或真实模型延迟。日频本地 5 次查询为 4/4/4/4/6ms、响应 10,433 bytes，仅本机 workerd 观察，不冒称生产性能。

## 独立审计、分工与发布边界

独立 GPT Auditor 对基线到稳定产品完整 diff、状态所有权、权限边界、真实 helper 单测及前后截图只读审查。确认并修复：

1. P2：证据点击后的下一帧，结果替换复用 DOM 可能指向新结果。修复为捕获目标 ID 并核验连接 / 可见性，结果按 scope 重建；实际 helper 竞态测试通过。
2. P3：引用列表收起后，返回按钮仍 connected 却不可见。修复为检查 hidden，回退到同一有效结果标题；旧候选浏览器已复现，最终五视口回归通过。

修复集中在 `08342a1`；`7fdc9a9` 只补个人文件 C 层提示方向。最终独立结论 **VERIFY PASS，无未解决确认 finding**，未将自检称为独立审计。

GPT 主导设计、接线、状态 / 焦点与最终审核；独立工作树执行历史片段、单测、浏览器验收，协调者集成。开发 DS 实际调用 1 次 deepseek-flash，仅无文件 / 无工具的文字测试清单；采纳 1–6/8，纠正第 7 条为应用已解析动效偏好而非仅系统媒体偏好。未外发私人截图、文件、行情、账本或 Key；开发 DS 与产品 AI 分列，不称产品消费。

剩余限制：真实 iPhone/Safari、软键盘 / 真机安全区、原生浏览器缩放及真机性能未测；mock 私有解释不证明生产 AI 可用。现有生产仍 Sites v34 / 实时模型未启用，本轮本地 UI 完成不关闭主 3.0 或分钟历史目标。下一步仅在用户授权上传发布后进入候选 CI 与正常发布流程。
