# MR-RADAR-RELIABILITY

状态：完成；2026-09-15。基线 `3bf421a`，开始时工作区干净；沿用 `codex/mr-radar-v2` 本地分支。

- Goal：解决上阶段行情连接失败的可修复原因与 Cloudflare 类型缺失，减少 Radar 空转状态更新。
- Allowed：lib/okx、market-data、必要请求辅助模块；Radar engine/hook；类型接入相关 tsconfig/package/scripts/db；测试与文档。官方 Response.json 收紧为 unknown 后，最小扩展 app/market-radar.tsx、components/cloud-monitor.tsx 的响应类型补充，无 UI 行为变化。
- Non-goals：不更换来源/币种，不放宽陈旧数据规则，不更改轮询/提醒阈值，不升级依赖，不推送、部署或更改仓库可见性。
- Evidence：沙箱 EACCES；沙箱外 ECONNRESET、响应体断开、成功 OKX 请求超过原 6 秒；未变扫描总是创建新 store；Cloudflare 声明缺失导致 tsc 失败。
- Plan / implementation：总时限内恢复传输错误，遵守 HTTP/业务限流与最长 Retry-After，合并相同 OKX 在途请求；官方 Wrangler types；相同 Radar 状态复用。
- Contracts：保留来源、币种、原始报价时间、现有失败状态与接口结构；没有凭据或数据库 schema 修改。
- Verify：最终构建成功，55 项 Node tests 通过，官方类型生成 + 全项目 tsc 通过，相关 ESLint 通过；5 种视口、17 项浏览器检查通过。真实四标的报价及 96 根 OKX 历史成功，未将休市数据视为实时信号。
- Measurement：固定行情 1,000 次扫描，无效 store/signals 替换从 1,000 降至 0；后 5 轮耗时中位数 18.21 → 13.86 ms，仅为本机微基准。
- Audit：独立只读审计提出监控代理+两条历史路径可能超过页面超时的问题；改为 6+16+8 秒预算并增加确定性测试。独立 Agent 因额度中断，最终复核由主代理完成。主代理另补并发限流保留最长等待时间及恢复后放行测试。
- Limits：未部署，未验证真机 Safari/云端 cron/生产网络；全仓 lint 与本地 Bash 构建包装脚本未运行；已有大 chunk 提示仍存在。详见 docs/RELIABILITY.md。
