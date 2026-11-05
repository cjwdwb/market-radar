# MR-PUBLISH-MARKET-RELIABILITY

## 发布结果 — 2026-11-05

**已上传并部署 Sites v37**，原网址 https://market-radar-rex.swt-aether.chatgpt.site 。本次源码 `2d2d08b831fb7131d100eade153918fed52e5355`；下方 Planner 为发布前记录。后续文档收尾不重新部署。主3.0、真实AI及独立数据任务继续开放。

| 对象 | 实际证据 |
| --- | --- |
| GitHub | [PR #13](https://github.com/cjwdwb/market-radar/pull/13)正常合并；候选d08b1ce与合并2d2d08b tree相同，无强推 |
| PR CI | [42022221321](https://github.com/cjwdwb/market-radar/actions/runs/42022221321)，job127227523134，Ubuntu/Node22.15：build/typecheck、761/761 Node PASS，0skip |
| main CI | [42022460094](https://github.com/cjwdwb/market-radar/actions/runs/42022460094)，job127228337018，同样build/typecheck、761/761 Node PASS，0skip |
| Sites version | 37；`appgprj_6a9b9dc23584819190a31ae417863e7a~appgver_8019f82d3d74819188fda2fde3e1c9c5` |
| Native deployment | `appgdep_6aec6f00209c8191bc21f08000959f96`，succeeded，2026-11-05T11:56:57.682418Z，env revision3 |
| 本地发布包 | `outputs/publish-reliability/site.tar.gz`，2050847bytes，SHA256 `b5ba1b67778e7a181dde06deefab4c822e78fa0522f80d52948b1c6369ead948` |
| 平台保存对象 | tar/46files/6860800bytes，hash `8fd3c499f6abf4be5b89ce4dd824aff18ac8b301562715af308ba24bc8033511`；与本地gzip及解压tar不是同一字节对象，分别记录，不声称哈希相同 |
| 受测构建 | server/index SHA256 `c1d38233adfc5d52e658d159a09a1a569e6baf13e1056a08d2cbfc986c0b84f3`，与1aac399本地验证构建一致 |

独立GPT源码范围与打包审计VERIFIED PASS：归档46个常规文件，运行文件逐字匹配dist；hosting manifest语义与tracked一致（原project、d1:null、r2:null）。无私人文件、账本、Key、额外绑定、测试工具、危险/重复路径或符号链接；本地解压tar6862848bytes/hash `cd09dd75596bf2ced82d7813d3fab8a37ee0c9869874fc6e468456dea6373697`。未改产品源码、秘密或访问策略，未发布独立monitor。开发DS0、产品模型0，无新采集/资源/数据库迁移；v36保留为既有回退版本，未创建/移动标签。

### 发布后只读检查 — 有限，后续刷新仍未验证

新测时间11:58:36–11:58:38 UTC，Node HTTPS、独立正常访客会话、GET-only。入口`/from-aether`303并取得内存会话；首页`/`200/99933bytes。首页响应触发验证相关内容识别，`cf-mitigated`为空，未保存正文，因此只能记录**验证相关标记，具体挑战状态未确证**，不能宣称实际封禁、页面故障或新版浏览器UI通过。

按预定停止规则，后续`/.rsc`、GET能力、BTC历史/报价及16秒后刷新6项均NOT RUN；没有换身份/网络/来源、重试或绕过。实际2次外层HTTP/99933正文bytes/1885ms，0直接供应商请求；与开发阶段3次合计5/24次、111626bytes。内部上游尝试UNKNOWN。Cookie只在内存，结束已清除；未保存正文/凭据、未导入个人文件、未读写提醒或调用模型。

证据：本地ignored `outputs/publish-reliability/production-check.json`、`probe-preparation.json`，原一次性脚本和锁保留在`reliability30-chart/outputs/publish-reliability/`。脚本实际执行与准备/独立只读审阅分开。入口/首页HTTP可达不等于行情刷新验证通过；生产登录后、浏览器交互、iPhone真机与FPS本轮NOT RUN。未来正常浏览器复查可补这条证据，不能删除本次停点报告重跑冒充首次成功。

### 交付状态

- CODE_FIX_VERIFIED：PASS（开发阶段审计/FIX/VERIFY、本次PR/main CI）。
- LOCAL_RUNTIME_VERIFIED：PASS（既有同产品本地Worker/五视口/持续刷新证据复用，未冒称本轮重测）。
- LIVE_SOURCE_CHECKED：开发阶段有限BTC成功/ETH限流；本次未到达供应商数据路径，不追认为全面恢复。
- PRODUCTION_REFRESH_VERIFIED：BLOCKED（验证相关响应标记触发停止；后续刷新未运行）。

上传与部署已完成；线上数据恢复结论保持有限。单独monitor内部状态/来源限流仍需后续诊断，不以本次站点发布代替其升级。源码、候选测试、平台终态与真实刷新四者分别记录。[专项报告](../../docs/MARKET_DATA_RELIABILITY.md)。

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
