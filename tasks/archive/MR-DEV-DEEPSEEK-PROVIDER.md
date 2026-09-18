# 当前任务

## MR-DEV-DEEPSEEK-PROVIDER

状态：完成受监督 Worker 最小接入与 GPT 审计；完整工具兼容/无人监督执行不在通过范围。

### Goal / Non-goals
OpenAI GPT/Codex 保持协调、设计、核心逻辑和最终审计职责；DeepSeek 仅执行明确授权的低风险子任务。此任务不是产品版本，不改产品、CI、依赖、Skills、默认 Provider、OpenAI 登录或生产环境，不部署、不推送。

### Baseline / Environment audit
- 基线 db35e5c，起始工作树干净，2.3 发布任务已归档。
- Windows；Codex CLI 0.154.0-alpha.6.2；默认模型 gpt-6-astra，无 model_provider 覆盖；CODEX_HOME 无环境覆盖。
- 用户 config.toml 存在；独立 CLI login status 为 Not logged in。桌面当前主会话可用，桌面认证方式与准确应用版本未确认；不能把 Chromium 文件版本当应用版本。未发现标准 VS Code extensions 目录中的 OpenAI 扩展。
- DEEPSEEK_API_KEY 在 process/user/machine 均不存在，仅检查存在性。未读取/输出凭据。
- 仓库没有 .codex 配置、DeepSeek/provider router；脚本、现有技能与 docs 定向搜索无对应集成。

### FINAL INTEGRATION PLAN
方案 B：仅用户级独立 deepseek-worker.config.toml + 少量仓库文档。当前 CLI profile 为独立文件，不能使用旧 [profiles.*] 表。先验证忽略基础用户配置时的 profile 加载，避免继承 MCP、插件、hooks 与其他认证能力；失败则暂停并修订，不自动降级权限。
Provider 使用官方 https://api.deepseek.com、responses、env_key=DEEPSEEK_API_KEY、requires_openai_auth=false，候选模型 deepseek-flash。默认 read-only、审批 never（受限操作失败返回，不能提权）、Web 关闭、子进程不继承密钥、不记录额外遥测。不设置全局默认，不使用官方一键替换配置脚本。
无自动 router、代理或降级重试循环；GPT 显式启动 CLI Worker，失败返回 GPT。本会话原生 sub-agent 接口没有 DeepSeek 模型选项，不能假称直接支持。

### Allowed paths / Impact
tasks/ACTIVE.md、docs/DEVELOPMENT_PROVIDERS.md；用户级 deepseek-worker.config.toml（无密钥，不进入 Git；外部写入遵守工具审批）。临时无凭据验证产物只存工作区外的系统临时目录。AGENTS/现有 Skills 暂不改，待验证稳定再决定长期规则。产品/API/provider 请求/CI 影响均为 0。

### Security / Validation gates
1. 本地严格配置解析、缺少密钥快速失败、前后默认配置哈希和 CLI auth 状态比较；不把解析通过当 API 成功。
2. 密钥由用户本机设置，禁止聊天传递/明文命令/产品 env。子进程过滤不等于防止同一用户读取用户级密钥；敏感文件不得进入 scope。
3. 只读 Worker 仅读 AGENTS、CURRENT_STATE、RADAR、INTELLIGENCE，执行定向搜索、git status、测试发现；检查前后状态，无修改。
4. 通过后独立工作树仅允许一个文档文件，GPT 检查完整 diff、未跟踪文件及验证；非授权修改拒绝。工作树不是文件权限白名单，真实边界必须测试。
5. 模型故障/无密钥时 OpenAI 主会话可继续；独立 CLI OpenAI→DS→OpenAI 真实验证需 CLI 登录，不修改现有 auth。最终 GPT 审计安全、兼容性和状态声明。

### Deferred / Acceptance
DeepSeek 原生 Web/MCP/其他 custom tools 不纳入首轮；shell/patch/tests 需实测，官方兼容声明不代表完成。缺密钥则 smoke/worker 测试标记 NOT RUN，任务保留待验证，不宣称 DoD 完成。无性能瓶颈，跳过 Optimizer。

最近完成：MR-PUBLISH-INTEGRATION。Market Radar 2.3 已发布为 Sites v20，源码 `f96a526`；发布记录见 `tasks/archive/MR-PUBLISH-INTEGRATION.md`，产品验收见 `tasks/archive/MR-RADAR-INTEGRATION.md`。

### Execution / GPT Audit / Verify
- 用户设置后发现一键配置将全局模型切到 DeepSeek，并在 config 内放入 bearer。GPT 已把密钥迁移至用户 DEEPSEEK_API_KEY、移除 inline bearer 和不兼容/强制认证字段、恢复 gpt-6-astra 默认；auth.json 未改。密钥未输出或进入仓库。
- 沙箱内的 CLI/config/env 观察与本机实际不同；本机提权只读检查确认 ChatGPT 登录有效。此前 Not logged in 仅为受限环境结果，不代表用户实际登出。
- 最终 profile 独立加载，model=deepseek-flash/provider=deepseek，never/read-only；禁用继承 MCP、apps/plugins/hooks/multi_agent。strict-config 通过。没有新框架、helper 或 Skill。
- 最小连接 READY；只读四文档读取和 git status 成功，无新增写入。第二轮独立 worktree codex/mr-ds-worker-validation，Allowed paths 最小扩展为 docs/RADAR.md，修正过期未发布文字；rg 搜索/测试文件名发现/shell apply_patch/git diff --check 成功。GPT 比较整个 worktree diff，仅一行文档变更，ACCEPT 并移入当前分支。
- MEDIUM 执行 finding：DS 首次补丁失败后未按任务要求返回 BLOCKED，且 handoff 漏报失败。本轮不把该行为认定通过；仅允许受监督低风险任务，最终 diff 已复核。LOW：只读摘要抄错长 SHA，GPT 以原始文档复核，未采用错误值。
- Compatibility finding：DeepSeek models 列表无法按 Codex models catalog 解码，回退元数据。未通过虚构配置消除警告；原生 custom patch/产品测试/MCP/Web/长上下文均未验证。
- Failure test：仅清空子进程 DS key，Worker exit 1 / Missing environment variable；用户 key 未删除。随后显式 OpenAI provider + gpt-6-astra 返回 OPENAI_READY，ChatGPT auth 保留，切回验证成功。
- 安全验证：只检查 secret 存在性；最终 repo 改动仅任务与开发文档、经 GPT 接受的一行 RADAR 文档。产品/CI/.env/package/锁文件未变；无生产部署、无 GitHub 推送。
- 本次只运行文档校验，不重跑产品构建/测试。最终 GPT 审计覆盖 diff、环境边界、profile、本机 OpenAI 回切和 DS 工具记录；未覆盖恶意模型隔离、真机 UI、长任务及所有插件。
