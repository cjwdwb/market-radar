# Market Radar 3.0B — Luna 受控试点交接

2026-10-08。离线适配、故障回归和独立审计收尾；真实 Luna 合成试点尚未运行。本报告不是当前市场解释或生产启用声明。

## 基线与实际阶段

独立工作树 `worktrees/ai30b`，分支 `codex/mr-30b-real-provider-pilot`，未提交候选的基线为 `7d2d30f6fe466a4e746ade2b3db231b2cb13b2d4`。PR #5 于 2026-10-08 08:38:33 UTC 合并；main CI [37751192029](https://github.com/cjwdwb/market-radar/actions/runs/37751192029) success 已重新核对。418/418 是原 Foundation 的远端证据，不计本轮候选新测。

现有生产记录仍为 Sites v32 / source `4a4b7fb66ac4fc10663087b42a09e08c55804e2a`。本轮未重新部署，未做生产登录后或 iPhone 验收；GitHub 源码合并不等于产品部署。旧 minute29 / minute-gate29 工作树的 26 个修改/未跟踪文件仍保留，本轮不写入这两个工作树。

| 交付 | 当前结果 | 证据与限制 |
| --- | --- | --- |
| A：固定 Provider、语义校验、持久预算 | PASS（离线） | mock Responses、SQLite、合成契约测试；没有真实模型输出 |
| A：真实合成试点 | NOT RUN | 用户已允许；process/user 的 OPENAI_API_KEY 存在性检查均 false，仅检查存在性、不输出密钥 |
| 合成模型质量 / 相比确定性模板的收益 | NOT RUN | 10 类输入已冻结；严格校验通过也不自动等于模型质量达标 |
| B：受控 snapshot 契约 | PASS（隔离测试） | 复用原 State 数学；真实来源用途准入为空，未配置实际 loader |
| B：真实输入准入与当前市场解释 | BLOCKED | 先满足 A 质量与来源第三方推理/展示权利；没有真实行情外发授权 |
| C：现有 fixture UI / 预算错误态 | PASS（本地） | 原按需 Hook 与往返路径保留；真实 Provider 结果尚未接入公开 UI |
| 新候选远端 CI / 生产启用 / 真机 | NOT RUN | 未 push、merge、tag、deploy 或配置生产真实模型 |

## 配置与价格依据

固定 `gpt-6-luna`、Responses、Standard（请求 `service_tier="default"`）、`reasoning.effort="none"`，并发 1、自动重试 0。没有其他模型/Provider 回退、工具、联网搜索、后台请求或自动续写。输出使用 strict Structured Outputs；拒绝、截断、异常 JSON 或证据校验失败均不展示为成功解释。

2026-10-08 官方核查：[模型](https://developers.openai.com/api/docs/models/gpt-6-luna)、[价格](https://developers.openai.com/api/docs/pricing)、[Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)。Standard 短上下文：input $0.10/M、cached input $0.01/M、cache write $0.125/M、output $0.50/M。官方文档支持 Responses、Structured Outputs 和 none；当前账号实际 entitlement、税费与附加费尚未验证。

完整请求（事实、提示、schema、配置）最多 32 KiB；预留输入上界按 UTF-8 全部字节数加 2048 token 包装余量，不假定缓存命中；生成上限 2048 token，响应流最多 64 KiB，完整调用 30 秒超时。费用预留按全部 input 的 cache-write 单价、output 上限和倍率 2 计算。倍率是保守预算约束，不能当成已确认税率或真实账单。首次付费执行前仍须核对账户实际附加费用上界，确认适用时才能使用 `--billing-bound-confirmed`；超出该上界则停在配置待决，不自动扩额。

`store:false`、无 conversation/background 不等于 Zero Data Retention。[数据保留说明](https://developers.openai.com/api/docs/guides/your-data)中的滥用监测、prompt cache、schema 处理仍须按账号政策区分。首批只发送自有合成事实，无市场数据、私人自选、完整聊天或凭据。

## 单一账本、失败与取消

项目 UTC 自然月产品 API 总预算 $8，派发阈值 $7，保留 $1 缓冲；固定试点 `MR-30B-SYNTHETIC-001` 最多 20 次预留派发且累计占用不超过 $0.25，先达到任一上限即停止。缓冲不保证能覆盖任意未知税费。所有已结算、在途与未知费用计入同一个账本，换用户、资产、任务、模型或进程不能自动清零。

本地权威库：`C:\Users\施文唐\Documents\ChatGPT\Market Radar\data\local\ai-product-budget.sqlite`，同路径 `.initialized` 标记。CLI 按受控脚本位置确定项目根，当前本地 worktree 共用该库；不提供任意 HTTP/客户端路径参数。显式初始化本轮已执行，只有零消费状态。该 SQLite 方案验证的是本机多进程；尚未提供多主机/云端共享账本，生产保持关闭，未来不能各环境新建 $8 配额代替项目合计。

派发前 `BEGIN IMMEDIATE` 原子核对占用和并发，落盘成功才发请求。缺失、损坏、不可安全写入或身份不符时关闭真实调用。删除库而保留初始化标记后也不能静默重建。正常启动不自动初始化，不删除/重置库或标记来恢复额度。

超时、取消、拒绝、解析/校验失败仍计尝试；有可信 usage 和匹配的模型/档位时结算保守费用上界，未知 usage、模型/档位不符时保留全部预留。账单值保持 null，不能把估算写成实际扣费。进程崩溃遗留 reserved 会阻止新并发，需要受控人工核对账单后处理；本轮没有自动退回或重置工具。

重复点击合并同一有效上下文的在途任务；每个订阅者独立取消，仅最后等待者退出才中止共享请求，未知费用不会因此退回。成功缓存 16 条/60 秒，绑定事实、资产、时间、权限与生成配置；读取再次准入，不能把旧快照重绑新行情。

本轮最终只读检查（2026-10 UTC）：

| 项目 | 实际值 |
| --- | --- |
| 产品 OpenAI 请求 / 单次 token | 0 / 不适用（没有真实调用） |
| 试点累计已结算 / 未知预留 | $0 / $0 |
| 当月累计已结算 / 在途与未知预留 | $0 / $0 |
| 剩余月度可派发 / 试点可派发上界 | $7 / $0.25（仍逐次预留、最多 20 次） |
| 本轮产品 API 费用 | $0；账本 billedCost=null，无供应商账单核对 |
| 开发 DS / Codex、行情和服务器费用 | 单列，不属于上述产品预算；不宣称项目总成本只有 $8 |

## 证据、受限综合与真实输入边界

旧 v1 `claimFor` 与引用校验保留。v2 `interpretation-v2` 允许模型选择/排列 1–3 条来自服务端事实 catalog 的确定性命题，含两窗口方向一致/不一致、Direction 与 RMS 是不同维度的说明。它是受限综合，不是开放金融自由写作；没有真实返回时不宣称比模板更有解释价值。

validator 同时核对文字和精确 refs、单位/窗口/数值、重复命题、主要证据、mixed 冲突与全部不可用限制。原 Context 的 mandatory 限制作为结果独立保留。新数字、因果、预测、交易建议、低波动等于低风险及历史胜率等无依据结论均不能通过。

10 类合成场景已冻结：aligned、mixed、relative unavailable、RMS lower、transition、no events、information absent、stale、partial、minute unsupported。冻结配置、输入 hash、预期事实/限制、禁止结论与最高预留；manifest 为 `outputs/ai30b/synthetic-1791452514921/frozen.json`。冻结操作 0 网络请求；它不是实际模型评估。运行时以真实当前时间冻结新的执行批次，同一固定 pilot 共用原账本，过期不自动更新事实来凑成功。

受控 snapshot 默认 `APPROVED_INFERENCE_RIGHTS=[]`，无权利时在 loader 调用前拒绝。未来 loader 候选是已有 `lib/market-data.ts` 的 getQuote/getHistory 与缓存/在途去重，本轮没有接入或请求真实数据。服务端 snapshot 绑定 scope、完整 symbol、事实/用途版本、TTL 及实际资产/基准依赖；返回克隆，读取再次核对原准备规则。relative transition / alignment 若使用基准，同样复核基准时效。原 State/Signal 算法、行情频率、提醒与访问控制未修改。

没有服务器 Radar session 输入时标 `not_included`，不能声称零活跃事件。每字段的第三方 inference、本地解释、公开结果展示权利分别核对；旧公开行情展示许可不是模型外发许可。本地真实服务另有 fixture-only 硬门禁，注入 admit 回调不能直接开启市场输入。B 暂未完成真实来源许可调查或准入验证，生产真实 API 路由未增加。

## 本轮验证与复现

Windows / Node 22.15.0；实际通过现有入口分项执行，未冒称执行 Bash 串联的 `npm test`。

| 新测 | 结果 / 本地产物 |
| --- | --- |
| Provider / 预算 / snapshot 专项 | 31/31 PASS；`outputs/ai30b/node-targeted.txt` |
| 全量 Node | 449 项：448 PASS、0 FAIL、1 既有 Windows symlink 权限 SKIP；`node-full-final.txt` |
| 最终 build / typecheck | PASS；`build-final.txt`、`typecheck-final.txt` |
| 新增与局部修改 lint | PASS、0警告；`lint.txt`。未重跑旧主组件全文件 lint，不冒称全仓 lint 全通过 |
| 五视口 / 现有解释与错误态 | 8 组 PASS；`browser/verification.json` 及 `ai-*.png` |
| 浏览器异常 | pageerror `errors=[]`；console 两条预期 429 错误来自新增故障模拟，未隐去，不能称零 warning |
| 新候选远端 CI / 生产 / 真机 / 真模型质量 | NOT RUN；没有推送、部署、Key 或真实输入许可 |

实际 Node 命令：

```text
node --experimental-strip-types --import ./tests/register-types.mjs --test tests/ai30b-provider.test.mjs tests/ai30b-snapshot.test.mjs
node --experimental-strip-types --import ./tests/register-types.mjs --test tests/*.test.mjs
node node_modules/vinext/dist/cli.js build
node scripts/typecheck.mjs
node node_modules/eslint/bin/eslint.js lib/ai/real-config.ts lib/ai/real-output.ts lib/ai/openai-provider.ts lib/ai/real-service.ts lib/ai/snapshot.ts lib/ai/product-budget.mjs lib/ai/context.ts lib/ai/validation.ts components/radar/use-interpretation.ts scripts/ai30b-pilot.mjs tests/ai30b-provider.test.mjs tests/ai30b-snapshot.test.mjs tests/browser/radar.mjs
```

浏览器复用 `tests/browser/radar.mjs`，`RADAR_AI30_ONLY=1` 与 `RADAR_AI30B=1`；Edge 149.0.4022.98 headless，loopback 生产构建，合成认证/行情、外连拒绝。1440×1000、768×1024、390×844、320×740、844×390；OS reduce 下分别覆盖 normal/system/reduced。包含按需请求、引用/缓存、共享结果、44px、无溢出、手动周期返回、取消/晚到跨资产、未配置及两种预算失败。桌面视口不代表真机。

第一次预览启动缺 TypeScript loader 导致连接失败，修正启动命令后通过；新增失败态脚本错误依赖无结果时不存在的按钮，修正为既有资产返回入口和严格折叠断言，未改产品来掩盖失败。

最终主 client chunk 825,987 bytes；3.0A 本机历史证据为 825,848 bytes（+139），不是本轮新测的成对基线。新 Node-only Provider/账本没有接入浏览器 bundle。既有 500 kB 警告仍存在；无新测可复现瓶颈，Optimizer 未做产品改动。真实模型组合负载、峰值内存、FPS 和前后交互性能 NOT RUN；fixture 延迟不能冒充供应商性能。

## GPT / DS 与独立审计

GPT 负责规划、价格/用途、预算与核心实现、集成和结果定稿。一次 DS 外发在执行前被自动审批拒绝，原因是具体预算文字的外发授权不足；停止该请求后，用户明确批准仅发送“月 $8、派发 $7、20次/$0.25、持久预留与独立取消”文字。随后通过现有 read-only/ephemeral Provider 实际调用 1 次 deepseek-flash，报告 3,013 tokens，实际账单未知；没有发送源码、行情、Key 或聊天历史。证据 `outputs/ai30b/ds/{result,run}.txt`。

DS 给出 6 条测试草案。GPT 采纳合并请求/单订阅取消/最后订阅取消的核查方向；拒绝“全部取消释放预留”的建议，因为未知费用必须保留。$7.90 预留场景不符合 $7 派发约束；“任何未知预留都拒绝下一次”也不是合同，均未直接采纳。配置可用与实际参与分别记录，DS 不是最终审核者。

独立 GPT market-auditor 对固定基线、未跟踪代码及稳定 diff 只读审查；已确认并修复：

| Finding | 修复与复核 |
| --- | --- |
| P2：返回非 Luna 模型仍按 Luna 低价结算 | 模型/Standard 档位不符保留全额未知预留；新增模型与档位负向测试，VERIFIED PASS |
| P2：受控 snapshot 只检查资产，旧基准可能背书 | 保存实际金融依赖，在 get 复核全部 prepareStateInput；relative/transition 基准测试及独立 6/6 snapshot 测试，VERIFIED PASS |
| P3：新增浏览器错误态依赖条件按钮 | 仅修测试选择器/折叠断言；最终 8 组已执行通过，独立最终复核 VERIFIED PASS |

独立 GPT 最终只读复核 VERIFIED PASS，无新增 confirmed finding：18 个审计输入文件 SHA 与 `outputs/ai30b/audit-input-manifest.json` 全部一致，tracked/staged/untracked、报告与各项新测证据吻合。最后一轮没有重跑全套或浏览器，不冒称审计员进行了真实模型、账单、多主机、真机、远端 CI 或生产验证。审计后仅更新结论文字与交接哈希，不改产品。此次结论只覆盖本地离线候选，全部 3.0B 仍未完成。本轮 loopback 测试预览已停止。

## 下一步与安全运行

本轮不归档为全部 3.0B 完成。Key 配置后先检查账号模型可用性及费用上界，再运行一个自有合成请求，检查返回/usage/校验/账本，然后才继续冻结批次。任何关键语义问题停止，最多一次依据明确的修正，仍计原 20次/$0.25 与月预算；不自动换模型或降低校验。

Node 22.15+ 的本地命令（在该工作树）：

```text
node --experimental-strip-types --import ./tests/register-types.mjs scripts/ai30b-pilot.mjs --inspect
node --experimental-strip-types --import ./tests/register-types.mjs scripts/ai30b-pilot.mjs --freeze
node --experimental-strip-types --import ./tests/register-types.mjs scripts/ai30b-pilot.mjs --run --billing-bound-confirmed
```

最后一条只在 Key 安全配置且实际费用上界核实后执行；本轮没有执行它。不要把 Key 放进命令文字、Git、fixture 或聊天。Key 不存在时保持 NOT RUN；原真实合成授权仍有效，不需要重问同一预算。B 需要实际来源用途决策和 A 质量证据后再推进；C 真实结果接入与生产开启也未获授权。没有购买、充值、密钥修改、真实数据外发、调度、上传或部署。
