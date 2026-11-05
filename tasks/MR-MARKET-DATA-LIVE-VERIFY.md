# MR-MARKET-DATA-LIVE-VERIFY

## Planner — 2026-11-05

用户要求补齐v37线上报价/K线后续刷新验证，有实际问题则修复。延续同项目，不改其他工作树/任务、来源/金融阈值、秘密、访问设置或AI；沿用原站点发布授权处理已确认的本专项修复，不据此开新服务或发布独立monitor。

基线：main/本地d78f3ce，当前站点原生get确认v37/public/active；生产源码2d2d08b/env3。上次发布后2个GET遇首页验证相关标记停止，具体挑战未确证；报告与一次性锁不改。当前重新开独立分支codex/mr-market-data-live-verify，工作区开始干净。遵循market-planner→必要builder→测试→独立audit/verify。

## 验证与边界

- 先读生产错误日志（仅安全字段），使用独立普通Edge上下文，从/from-aether正常进入；不读取私人浏览器状态、不绕门禁或交互破解挑战，不以HTML中单个通用脚本字符串判定整页被拦。检查实际页面标题/正文/工作台/挑战状态，保留脱敏证据。
- 本批正常页面观察最多60秒、至多18个站点非静态请求（含入口、页面、RSC、能力及行情）/4MiB行情正文，前批已用5/24，累计不超过23/24；静态资源单独限60次/10MiB并计数，上游内部请求UNKNOWN。不加载fixture、不伪造会话/行情、不改生产存储/刷新策略；全新浏览器默认设置，允许正常UI暂停以结束观察。只用关闭上下文或拒绝超预算请求终止，不制造成功响应。
- 默认有限资产（站点已有默认自选/概览），观察首次与后续quote/fetchedAt/bar/confirmed；必须区分原生15mbar未跨边界与同bar更新。实际授权范围内查看图表和返回，安全时核对显示周期、未知/延迟/错误、暂停/恢复、手动刷新。若来源403/429/明确拒绝立即停止该来源后续操作，不换地址/身份重试。
- 如果实际页面正常且仅旧检测脚本误判，修验收记录/探测器即可，不为流程改产品。如真实数据请求失败，结合对应trace/Worker日志定位；只修能证明的协议/刷新/展示/超时错误，不修改来源许可或绕供应商限制。
- 普通浏览器自然执行平台脚本不等于手工绕挑战；若出现需人操作的安全挑战，停止并记录BLOCKED。未获得数据不能用本地模拟替代PASS。

## 允许路径 / 验证门槛

任务卡/ACTIVE/专项报告/发布索引及ignored本批证据；仅确证问题所需lib/market-request.ts、market-data.ts、okx.ts、market-history.ts、API routes、现有行情hooks/主图与关联tests。任何新增实现先在本卡写触发条件/原因/最小修复；不做无关UI重构。源码修复跑相关回归，影响集成时build/typecheck/fullNode、浏览器及独立审计；无产品改动不重跑全套。

产出分开：当前生产、实际页面/数据后续刷新、缺陷/修复候选、重新发布与复测。已有预算限制保留，需扩大时先说明；原历史503根因不追认。开发DS不强制，产品AI0。

## Confirmed finding P2 / Builder slice

独立GPT离线复现：配置代理若返回现有标准errorInfo（timeout/504、upstream_denied/502、invalid_data/502、environment_denied/503），通用marketJson先拒绝HTTP，history route又将5xx改为proxy_unavailable；具体分类丢失。此问题已确证，但不是当前线上旧代理503的已知根因。线上12:11:17/31两条仅证明proxy503，12:11:46路由已恢复200。

最小修复允许lib/market-request.ts、app/api/history/route.ts、相关transport/runtime tests。只对配置代理显式开启标准错误读取：小型有界JSON、原截止/取消/字节/尝试预算内，严格枚举及HTTP错误码一致性校验；不接受远端自由消息/trace作为本地权威，保留网站trace及固定文案。保留已验证远端错误分类/必要状态，区分代理自身401/403与代理报告供应商拒绝，429冷却取保守最长。HTML/旧消息/畸形/不一致正文继续按原HTTP分类，不从503推断429，不新增回退/重试，不改成功数据与鉴权。

纯离线mock覆盖标准timeout/denied/invalid/environment/rate、旧503、畸形/超限/不一致body、原trace、bodytimeout/cancel、拒绝不回退；实际Worker必要专项后全量验证，独立VERIFY。并行Builder独立live37-proxy worktree，只写上述文件，协调者集成与发布。

## 本轮真实浏览器观察与来源隔离续测

2026-11-05T12:25:57Z正常新Edge进入/from-aether→工作台，页面标题/布局正确，没有可见挑战，无pageerror。6个非静态请求、14个静态请求，行情正文2388bytes；Yahoo股票批次返回明确rate_limited/429，立即关闭上下文，BTC报价/K线尚在途，不能记后续刷新PASS。原生Worker日志证实K线请求被客户端取消。前批5+本批6=11/24；报告/锁保留，未重跑。

下一次只核对未被拒绝的加密来源：普通新浏览器，提前拒绝已知限流的Yahoo股票报价/历史请求，不替换任何响应，不改URL/凭据/存储。界面股票因此不可用，不能将此约束实验称作完整市场正常。其余Crypto自然请求保留；Crypto出现拒绝/限流即停。最多12非静态请求、60秒，合计至多23/24，静态与字节上限沿用。此处是停止受限来源后的独立来源观察，不是通过新身份重试被拒绝的Yahoo。证据单独放outputs/live-verify37/crypto-isolated，旧证据不修改。

## Confirmed finding P2 / 部分报价运行摘要

隔离股票后的真实BTC观察24.553秒，5次报价、2次96根K线成功，fetchedAt向前15067ms，同根未收盘bar的低/收/量真实变化，页面显示同步；无pageerror/横向溢出。ETH/SOL小图仍代理503→502，未恢复。共12非静态，本任务累计23/24，停止继续来源探测。

同时实际DOM复现：BTC主价/图表已更新，但运行摘要仍称“尚未取得有效报价”。原因是lastFetched只在所有请求资产（包括辅助benchmark）成功后赋值；其语义应保留，不能为了提示改刷新/有效性。最小修复只改app/market-radar.tsx运行摘要：有已取得且无错误报价但整批尚未成功时，明确“部分报价已取得，其他标的待更新”；无报价仍显示等待，不说全部恢复。整批时间的文案准确称为整批获取。仅允许该局部提示及tests/browser/market-reliability.mjs部分失败验证，不改行情hook/频率/数据/算法。与代理错误修复独立切片，集成后构建与五视口受控回归、独立审计。
