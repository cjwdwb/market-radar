# MR-PUBLISH-MARKET-RELIABILITY

## Planner / 授权 — 2026-11-05

用户明确批准“可以，上传 GitHub 并部署到原站点吧”。本发布只交付已审计的行情刷新/K线候选，保留原网址、public audience、应用访客/站主边界与关闭的真实AI。不修改秘密、云资源、生产数据库或监控配置，不发布独立monitor，不开展历史采集。

重新核对：GitHub main `4352b732660dbfd200d629d5f6d1b3349687a6e1`；候选 `2cf46804aebe140baec202bc0464cf58d1d12f68`，产品 `1aac399c90b8af58c49c356379bdeb773e999ca7`，工作区干净。Sites原生get确认原项目 `appgprj_6a9b9dc23584819190a31ae417863e7a`、public、v36、https://market-radar-rex.swt-aether.chatgpt.site ，原源码84511bf/env3。官方source helper已打开同一工作树；不覆盖其他任务。

## Scope / 允许路径

仅本发布卡、ACTIVE、专项卡/报告、CURRENT_STATE、VERSIONS的必要授权/发布记录及ignored包装/验证产物。可修复审计确认的测试文件末尾空行。无计划产品改动；CI/打包若证明缺陷，先记录最小修复再验证。

## 执行与验收

1. 正常push当前候选分支，创建PR并等待Ubuntu/Node22.15的build/typecheck/fullNode；通过后正常合并，不强推。
2. 用已合并的相同产品源码和已验证dist，经官方Sites helper正常推送来源并打包；输入未变的成功构建不机械重跑。
3. 独立GPT只读核对来源、归档内容/哈希、manifest与隐私边界；确认无Key/账本/私人文件/测试工具/额外绑定。
4. 保存并部署到原public站点，等待原生终态；不把succeeded当作行情完全恢复。
5. 低频真实复测保留原专项总预算24外层请求/8MiB，目前已用3次/11693bytes；本次生产复测领取最多8次/4MiB，并发1、无自动重试，来源拒绝/限流立即停止，不绕过门禁。入口/API/后续刷新与构建标识分别记录，未运行项不记通过。
6. 归档发布卡，更新ACTIVE/CURRENT_STATE/VERSIONS和专项结论，上传文档收尾；不为文档再次部署。

## 已有可复用证据 / 独立审计

产品1aac399本地build/typecheck、760PASS/1Windows权限SKIP；Worker16PASS、五视口行为125PASS(648010e)，最后显示修复后15张截图/15项溢出检查与7项正常计时检查通过。独立源码及修复、报告VERIFY已完成；本轮新增发布范围独立审计确认47文件均在范围、无秘密/访问/AI变更。不能把历史本地验证冒称新CI或生产刷新通过。

Optimizer：没有新瓶颈，跳过。开发DS0、产品模型0。线上源恢复仍待有限实际观察；旧ETH限流与远端代理内部不可观测限制保留。
