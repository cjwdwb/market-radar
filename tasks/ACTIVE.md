# 当前任务

## MR-RADAR-INTEGRATION — 2.3

状态：BUILD / AUDIT FIX / 代码 VERIFY 完成；最终浏览器复测待授权。基线 `899b59ef1e8eea7cc51a29561628963a309ce121`；工作树开始时干净。

### Goal / Non-goals
同一个资产上下文的 Classic ⇄ Radar 工作流；不改 Signal/Confidence/ranking、覆盖范围、行情来源、刷新、API、认证。无新框架、依赖、数据库、Signal、AI、市场状态；不推送、不发布、不建立发布标签。

### Selection / Navigation / Context audit
- selected、range、watchlist、alerts、marketMode 及唯一 useRadar 在父组件共享；长期仅保存 watchlist/alerts/运行设置/默认体验。
- Radar filter/showHistory 为 Feed 局部状态，details 是 DOM 状态；两个体验 hidden 而不卸载，切换保留。Classic 搜索/排序/图表 viewport 无需共享。
- hashchange 切 mode/section 并原生滚动；非 price-chart hash 清除 From Radar。
- From Radar 缓存完整事件对象，存在事件 resolved/cluster 改变后旧事实残留风险；symbol 切换虽然会清空，事件更新不跟随。
- chartRangeForEvent 只在点击事件时设置，手动 range 不被 effect 覆盖；保留这一行为。普通模式返回不能再次套用建议范围。
- Classic 近期记录使用 raw history；本轮 awareness 使用已排序 intelligence.events，不能重算 pipeline。

### Final scope / Proposed context
1. 扩展 lib/radar/workflow.ts：按 selected 派生 active events/primary，复用原排序与对象引用；纯函数从当前 events 解析短期事件引用（symbol/id），不缓存事件对象。
2. 图表头部下方只放一个 compact Radar awareness（数量与主事件；无事件/暂停/等待明确文本），点击到 Radar 同资产 context。原 From Radar strip 移至图表旁，当前事件不可用时诚实提示，可关闭/返回。
3. Radar 接收短期 asset context，由共享 selected 派生；使用独立的上下文过滤覆盖用户 Feed 筛选，关闭后恢复原 filter/showHistory。突出对应事件但默认不展开，不自动抢焦点。提供返回同资产图表按钮，保留用户 range。
4. 所有手动 symbol 选择让不匹配来源引用失效；hash 普通导航清除临时来源；事件首次打开才应用 chartRangeForEvent。
5. 复用同一 watchlist/alert callbacks；展开卡片显示该资产已启用价格提醒数量（用户条件与 Radar 检测分开），已有提醒入口查看现有提醒，避免从 Radar 盲目重复创建。

### Allowed paths / architecture
app/market-radar.tsx、app/radar.css、components/radar/radar-feed.tsx、单一 components/radar/asset-context.tsx、lib/radar/workflow.ts；tests/radar-engine.test.mjs、tests/browser/radar.mjs；docs/RADAR.md、docs/CURRENT_STATE.md、docs/VERSIONS.md、任务卡和归档。必要 UI 样式仅在既有 rules 原位整理。Engine/useRadar/network/contracts 不变。

### Requests / performance
新增 provider symbols=0、API=0、Radar timer=0、Engine=0。导航无新增请求；显式新 symbol/range 使用已有请求。helper 单次线性过滤最多 120 信号对应 events，memoize 当前 events/selected。记录构建 chunk 大小；仅测得回归才进入 Optimizer。

### Acceptance / Tests
- Node：0/1/多事件、排序、resolved/expired 排除、relative 原对象、事件变更/换资产/缺失引用、watchlist 重新排序不复制数据；range fallback 回归。
- Browser 复用 tests/browser/radar.mjs：Classic→资产 Radar→Chart→返回，筛选保留；手动 range 保留；换 symbol 无旧 context；watch/unwatch/persistence/alert 状态；连续模式导航 API 增量 0；paused/empty/failed、实时 reduced-motion。
- 1440、768、390×844、320×740、844×390：默认折叠、键盘可用/焦点明确、触控≥44、无横溢；本地截图。脚本更新与真正执行分开记录，努力恢复 Playwright 验证。
- 相关 Node tests → build/typecheck → 全 Node suite（集成变更）；独立 AUDITOR 对固定 diff 只读报告，BUILDER fix 后复核。

### Deferred
自选行徽标、大型 Asset surface、详细相对情报、精确 scroll restore、复杂展开控制、P2 summary/history、2.5/2.8 能力。任务由 owner 顺序实施；独立审计仅只读，不编辑共享 checkout。

### Execution / Audit
- BUILDER 按上述 scope 完成，新增 asset-context 组件与 workflow 纯派生 helper；无产品依赖、Signal、API、timer 变动。
- 30/30 Radar tests；70/70 全 Node suite 在审计修复前通过。修复后相关 30/30 与最终构建/typecheck 已复跑。Windows Sites build wrapper 启动 npm 失败，改用现有 Vinext build 入口，未改项目 scripts。
- 本轮基线 Edge 22 检查/五视口实际通过。2.3 新增五视口完整流程已实际执行；随后旧 suite 的导航计数捕获 3 条正常定时请求导致总脚本失败，不能报告整套通过。
- 已修测试时钟：仅测导航时暂停轮询并推进帧；代码无轮询变更。该复测工具返回用户拒绝；已异步询问许可，未再绕过运行。表格回归同样未执行。
- 独立 AUDITOR（integration_audit）发现 1 MEDIUM：自选表直接 setSelected，换回旧资产恢复来源。两处改 selectAsset 并补保持 hash 的浏览器回归。Auditor Verify：已修复，剩余 BLOCKER/HIGH/MEDIUM/LOW=0（代码只读，不宣称执行测试）。
- 主 chunk 726,707→730,018 bytes，约+0.46%；无可证实瓶颈，Optimizer 跳过。图表/来源/同资产 Radar 截图在 outputs/radar/integration-*.png，预览 http://127.0.0.1:5175。
- 待：获得浏览器许可后执行 RADAR_INTEGRATION=1 的 tests/browser/radar.mjs，保存报告、更新文档并归档。本地 Playwright 位于 C:/Users/施文唐/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright。NOT DEPLOYED，未 push/tag。
