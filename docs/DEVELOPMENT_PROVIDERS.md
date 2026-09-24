# Development Providers

核验日期：2026-09-17。开发工具集成，不是产品版本。状态：受监督 CLI Worker 已完成连接、只读和单文件文档验证；不代表完整 Codex 工具兼容。

## Roles and authority

GPT / OpenAI Codex 是协调者，负责 Planner、产品与架构、核心金融逻辑、安全、最终审计和发布。DeepSeek 仅接收 GPT 明确限定的低风险阅读、文档、测试或小修任务。Provider 不改变 PLANNER / BUILDER / OPTIMIZER / AUDITOR 职责，不新增 Skill。

No DeepSeek-produced product code is considered complete until GPT / Codex reviews the diff and relevant validation results.

Worker 不得自行扩 scope、改依赖或锁文件、合并、发布、破坏 Git 历史。范围不足返回 BLOCKED / NEEDS ESCALATION；不建立自动 Provider fallback 循环。最终审计始终由 GPT 执行。

## Local setup

当前 CLI：0.154.0-alpha.6.2。用户配置保留默认 GPT，独立 `~/.codex/deepseek-worker.config.toml` 使用 `deepseek-flash`、Provider `deepseek`、`https://api.deepseek.com`、`wire_api = "responses"`、`env_key = "DEEPSEEK_API_KEY"`、`requires_openai_auth = false`。

当前版本 profile 为独立文件，不能用旧 `[profiles.*]` 表。实际配置只保存在本机；仓库、产品 env、CI 不存密钥。不要运行会替换全局模型/认证的配置脚本。不要使用 `experimental_bearer_token` 明文配置。

独立 profile 默认 read-only、approval_policy=never、Web 关闭、apps/plugins/hooks/multi_agent 关闭；本机继承的 MCP 条目逐一禁用。禁用 MCP 条目仍需要有效 transport 字段。新增本机 MCP/配置后必须重新审查继承，不假设 profile 自动隔离一切。

子进程环境使用 core、关闭 shell profile、启用默认秘密名称排除并过滤 KEY/TOKEN/SECRET。密钥由 Codex 进程读取，不应传入模型 shell。用户环境变量不是加密保险库，也不是对同一用户进程的强隔离；Worker 不得读取用户配置、注册表、凭据或完整环境。

Windows 在系统界面的账户环境变量中设置 DEEPSEEK_API_KEY，避免真实值进入聊天、命令历史和日志。已启动的进程不自动获得新用户变量，可在派发终端仅加载引用：

```powershell
$env:DEEPSEEK_API_KEY = [Environment]::GetEnvironmentVariable('DEEPSEEK_API_KEY', 'User')
if (-not $env:DEEPSEEK_API_KEY) { throw 'Missing DEEPSEEK_API_KEY' }
Get-Content -LiteralPath '<reviewed-task-file>' -Raw | codex exec --profile deepseek-worker --strict-config --ignore-rules --ephemeral --sandbox read-only -
```

不搭配 `--ignore-user-config`：本机测试未加载 Worker profile，实际启动了 OpenAI。每次确认启动头中的 model/provider/sandbox；不符立即停止。`--ephemeral` 减少会话文件留存，不保证日志或终端记录为零；不得使用 debug/trace 输出请求头或秘密。

普通 Codex 继续使用主配置的 GPT/OpenAI。写任务先创建 `codex/<task>-ds-worker` 独立工作树，明确单文件/小范围 allowed paths，再显式改用 workspace-write。工作树与 allowed-path 提示不是强制文件级访问控制；GPT 必须检查整个工作树 diff 和未跟踪文件。

## Task and handoff contract

每次只传 TASK ID、ROLE、OBJECTIVE、ALLOWED READ/WRITE PATHS、READ FIRST、DO NOT TOUCH、ACCEPTANCE、TESTS、OUTPUT FORMAT。不得传完整聊天历史。返回 STATUS、FILES READ、FILES CHANGED、TESTS RUN、RESULT、KNOWN RISKS、NEEDS GPT REVIEW，不输出长思维过程。

GPT 接收后检查 scope、事实、完整 diff、安全和实测结果，明确 ACCEPT / REQUEST FIX / REJECT。失败由 GPT 决定下一步，不让 Worker 自行扩大权限。

## Verification and limits

| 能力 | OpenAI / GPT | DeepSeek 实测 |
| --- | --- | --- |
| 主协调、最终审计、发布 | GPT 负责 | 禁止委派 |
| Responses 连接 | 本会话可用 | deepseek-flash 返回 READY |
| 仓库读取 / shell | 本任务已使用 | 四份指定文档读取成功 |
| 搜索 / 文件列表 | 本任务已使用 | rg 定向搜索、tests 文件名列表成功 |
| Patch | 本任务已使用 | shell 调用 apply_patch 成功；原生 custom tool 未验证 |
| 校验 | 本任务已使用 | git diff --check 成功；产品测试执行未验证 |
| MCP / Web | 本任务 Web 可用 | 关闭、未验证；不作为 Worker 能力 |
| 无密钥失败隔离 | 主会话可继续 | 缺密钥明确报错，exit 1 |

只读任务没有写入；单文件任务只改 docs/RADAR.md 一行发布状态，GPT 核对后接受该 diff。Worker 首次 apply_patch 使用 stdin 失败后自行重试，未遵守“工具失败返回 BLOCKED”，最终交接也漏报失败；因此仅接受修正后的文档结果，不认可无人监督执行。只读摘要还抄错了长提交号，必须复核事实。

CLI 模型目录刷新不能解析 DeepSeek `/models` 响应（缺少 models 字段），使用 fallback metadata；Responses 对话仍成功。上下文上限、长任务、压缩和原生 custom tool 不据此宣称可用；不为消除警告新增代理或编造 catalog。

文档与配置不改产品运行依赖；没有密钥仍可开发 Market Radar。此次不重跑未受影响的产品构建/测试。未测试恶意越权、任意网络逃逸或真机 UI；提示约束不能替代沙箱。

## Official references

- [OpenAI configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference)
- [OpenAI profiles](https://learn.chatgpt.com/docs/config-file/config-advanced)
- [DeepSeek Responses compatibility](https://api-docs.deepseek.com/zh-cn/guides/responses_api/)
- [DeepSeek models](https://api-docs.deepseek.com/quick_start/pricing/)

官方资料确认 Responses/function 和特定 apply_patch custom 格式；内置 Web、MCP、computer use 等被忽略，其他 custom 名称可能失败。官方能力声明与上表本机实测分开；不把兼容 OpenAI API 当完整 Codex 兼容。

2026-09-17工具集成记录：Production: NOT DEPLOYED（本开发工具任务未发布；网站仍为既有 2.3 / Sites v20）。详见 ../tasks/archive/MR-DEV-DEEPSEEK-PROVIDER.md；当前发布见 ../tasks/archive/MR-PUBLISH-PERFORMANCE275.md。

本机回切验证：ChatGPT 登录有效；子进程不含 DeepSeek 密钥时，以 OpenAI provider / gpt-6-astra 返回 OPENAI_READY。受限沙箱最初的 Not logged in 不代表本机登录失效。
