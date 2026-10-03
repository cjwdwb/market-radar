# MR-29-A-REAL-DATA-PILOT

2026-10-02。状态：Planner定向调查完成；真实采集Gate待外部条件；允许先实施独立的A-Q查询前置切片，不代表A完成。主台账：[MR-29-REAL-DATA-WORKFLOW](MR-29-REAL-DATA-WORKFLOW.md)。

## 基线 / 授权 / 已核对事实

- main `31702c45c653e5e33bac258c110f159d432d5b87`，CI37004484343 success（本轮查询，运行本身为历史证据）。生产v29/source2ad04ee；本轮不重新部署。
- `market-radar` 原工作树27b0bab干净保留。最新`market-radar-p0-repair`31702c4工作树/暂存/未跟踪干净，从已完成发布分支切独立`codex/mr-29-a-real-data-pilot`。不用reset/clean，不动旧数据。
- 已读AGENTS/ACTIVE/Planner/Builder/Auditor、CURRENT_STATE、PROJECT、2.8任务、DEVELOPMENT_PROVIDERS；定向核对源码和ARCHITECTURE/API契约。不重查已关闭P0根因。
- 基线时ArchiveStore schema2仅fixture价格+固定FED信息，query无周期和首请求固定版本参数；本轮A-Q已补查询参数，详见末尾结果。history-package-v1/回放仍仅fixture，FED恢复有专属校验。runner限每批2资产/2000写入/20请求/60秒，不能承受90天总量，也不构成跨批总限额。
- 正式清单尚无：主项目`data/local`仅.gitkeep；不读取私有浏览器/默认自选/monitor种子。旧任务没有价格保存/展示许可。已集中询问清单路径或代码、已获准供应商/用途、必要付费上限。
- 本机现有`work/state27`及预留`data/local`沿用，不重复索要位置；runner目前只支持前者。新试点拟用`work/state27/stage29`，不移动旧库；独立恢复目标在其新子目录，正式异地备份/期限留B。

## 来源核查和最小决定表

本轮低频官方文档请求共10次，不请求价格端点。最初两个条款URL因禁止自动重定向而失败；各一次manual元数据确认官方302/308，再只读取它们明确指定的同域目标及Massive官方引用的两个附加条款。最终6份正文200；无403/限频绕过、身份/代理替换。元数据/正文在被忽略`outputs/stage29/sources`，不含名单/凭据。官方链接与结论详见docs/HISTORY_STAGE_A.md。

| 来源 | 本轮技术/价格事实 | 权利与真实动作 |
| --- | --- | --- |
| OKX history-candles | 原生5m/15m；毫秒开盘；after更早/before更晚；max300；20次/2秒/IP；confirm=1完整；spot vol基础币、volCcy/volCcyQuote报价币；股票永续adjust不可混入spot | 本轮取得API Agreement，9.4明确第三方展示/再分发须书面同意，也限制竞争数据/分析平台及超个人合理规模采集；公共端点同样适用。不能仅凭开发授权批准本任务保存/研究/展示用途 |
| Massive Stocks | 官方个人定价页列Basic $0/5calls每分钟/2年历史/分钟聚合/EOD；Starter $29/月/5年历史/分钟聚合/15分钟延迟；均Individual use | 已取得个人条款及Market Data附加条款：默认display-only，non-display/derived用途须相应许可，第三方数据及研究输出分发受限。个人套餐本身不能证明本任务研究/展示获准；账户/地区/90天端点/session未实测，不购买 |
| Yahoo | 旧官方条款核查要求自动化/归档许可 | 无新授权，不因为实时可用而批准历史 |

| 缺项 | 已有证据 | 候选/推荐与取舍 | 量/费用假设 | 阻塞动作 |
| --- | --- | --- | --- | --- |
| 正式集合 | 无用户导出，data/local空 | 用户指定集合后选5–10代表资产及共享必要基准；不按研究表现选样 | 总序列数需去重，以下用5–11估算 | 冻结universe/实际采集 |
| 源及用途 | 两候选均存在明确用途边界 | 优先用户已有含保存/研究权利的供应商；若无，取得OKX适用书面许可或股票供应商non-display/研究及必要展示授权。不建议仅买Massive个人套餐假定解决研究权限。当前无已批准可开跑来源 | Massive挂牌0/29美元仅个人展示候选；专项许可未取得报价，OKX不假定费用0 | source注册、真实adapter启用及展示 |
| 费用/批次批准 | 未知数据预算 | 不采购；先确认个人研究范围，第三方展示另按合同判断 | 下表为资源建议上界，未授权/未实现 | 付费/真实批量执行 |

## 最小真实契约（待源准入后冻结具体值）

序列身份：sourcePolicyVersion、规范asset、market、venue、productType、providerId、currency、nativeIntervalMs、adjustment、有效期；不合并USD/USDT/现货/永续。owner与访客自选分离；批准集合不随Watch变化。

批次固定[from,cutoff)，市场时区明确，crypto候选UTC。A目标cutoff前90自然日；不是已冻结或已采集。5m预热至少37根覆盖Medium180/原22下限（研究只选具有完整依赖和30m目标的候选）；最初预热不伪装目标内覆盖。source confirm、真实网格、session和端点包含性需adapter样例核对；不插值。firstReceived/版本收到/计算时间取真实执行时间；历史current_vintage重构不变observed_live/PIT。

runner沿用事务和checkpoint：新跨批pilot账本必须持久化所有请求/拒绝/字节/写入/重试消耗；换runId/重启不能归零。未获准前不实现通用任意URL或注册开关。批准adapter固定host/path、拒绝重定向、有限body/超时、Retry-After、不重试403；单并发并为实时保留余量。预算字段是硬拒绝条件，不能只做日志。

四种预算分离（建议值，最终取批准规模更小者；真实路径尚未实施）：总库400000事实/512MiB（WAL和工作空间另留余量）；查询每页200、单窗31天/2000bar；单包2MiB/2000bar；浏览器仅一份当前包+有界结果，失败保留旧包时最多临时两份，计算前校验限额。90天拆有界查询，不整段塞包。归档备份需要带版本/manifest的有界分片，不能将现有10000行/16MiB导出限额改成无限。

估算：24×7市场5m=90×288+37=25957根/序列，5–11序列129785–285527根；300/页理论435–957页，尚无真实消耗/缺口结论。按25%修订留量，最高356909事实（向上取整）；每事实含索引暂按1KiB估~349MiB，另两份备份~1.1GiB，非实测。建议全pilot≤3000请求、1100成功页、256MiB网络、400000写入、2小时累计执行、并发1，每2秒最多1请求；授权后需落实事务性累计停止。首技术试跑单资产/必要基准1日+预热，≤12请求/8页/1200写入/4MiB/180秒；再扩批准集合。股票按核验交易日历另算，不套24×7完整率。不得把建议预算当批准。

本地查询面拟固定loopback、read-only capability、来源/owner/库路径在runner启动时绑定，严格Host/Origin/路径/页数和响应限额；不读生产Cookie，不提供任意SQL/URL/路径，不暴露局域网。实际网页接入必须本地开发代理/受控同源模式，Sites不能直接读取本机SQLite。该接口待真实契约/安全审计，当前不新增HTTP路由。

真实传输须新版本身份，保留旧fixture包；不能强制as HistoryPackage。query/export/restore/UI来源一致；source grant与digest分开。回放复用原directionForWindow/volatilityForWindow和90/180窗口；研究冻结same-asset-short90-forward30-v1、0.30pp/0.20容差、10–200样本、完整依赖+30m结果非重叠。A不实现历史Relative/Alignment/Transition或新研究协议。真实数据缺源/不足时保持BLOCKED/insufficient，不包装成可用。

## A-Q：现在允许的独立Builder切片

这是用户允许继续的未受阻接口工作，不放开真实来源。先定稿：

1. ArchiveStore.query新增可选intervalMs(仅bar，300000/900000)及首请求readRevision(整数0..当前revision，含端点)。SQL参数化过滤；新签名绑定周期，版本存cursor并校验显式参数一致。旧参数缺省语义/旧游标保持兼容；跨周期/跨owner/source/asset/cursor-version拒绝。后页不指定readRevision时沿cursor，指定时必须一致；非空非法周期INVALID_QUERY_INTERVAL，非法/未来版本INVALID_READ_REVISION，游标不符INVALID_CURSOR。缺省周期不是默认5m：沿旧全周期行为；省略版本是首次latest/后续cursor版，不能静默改显式版本。
2. exportHistoryPackage可选转发周期/版本；仍fixture-only，仍31天/2000根/2MiB；混周期的旧调用继续明确失败，不自动挑一组。固定版本到导出恢复后仍可查询，不读取未来修订。
3. 暂不改source-policy/schema/runner、live数学、UI、包格式/身份、安全门禁或P0路径守卫。不因此声称真实adapter/网页查询已交付。

允许写：collector/store.mjs(query局部)、scripts/history-package.mjs(参数转发)、tests/history29-query.test.mjs、任务两卡/ACTIVE、docs/API_CONTRACTS.md、docs/HISTORY_STAGE_A.md。以后真实切片必须先更新本卡并满足对应外部Gate。

测试：同source/asset不同周期同开盘不混；历史修订A/B/A固定版本；跨周期/版本cursor拒绝；旧游标兼容；非法/未来版本、错误kind/周期；导出恢复并重启后相同query/replay；旧模拟包、FED、P0回归。先专项，再Windows分项build/typecheck/全量Node（npm test含构建，不重复包装）。此次无UI改动不冒称新浏览器验收；Stage A整合后仍必须五视口/本地HTTP身份/查询代次验证。

## 分工 / 审计 / Gate

GPT负责上述契约、核心查询/导出实现、验证/集成。DS仅在已有配置可用时于独立worktree按固定契约生成低风险测试清单/文档，禁读私有清单/DB/配置/凭据；一轮及最多一次指定修正，逐项核对实际输出后记录采纳。独立GPT Auditor审查稳定diff，重点旧fixture兼容、跨序列/版本、恢复语义与未获准来源未开放；不冒称真实全链路审计。无实测瓶颈不Optimizer。

真实Builder/执行Gate：正式集合+适用源许可/用途+冻结范围/累计硬预算+既定本地存储/新空恢复目标齐备，才准入真实源、跑1资产技术贯通并扩冻结集合。费用或权限仅阻塞相关动作；已授权A-Q继续。用户未答复不当作批准。真实覆盖、查询网页/恢复/回放/研究必须分别有证据后才关闭A。B/C、发布、购买、生产迁移、常驻采集未授权。

## A-Q实际结果（Stage A仍开放）

产品仅store.query与history-package参数透传，新tests/history29-query.test.mjs共7项。Blob固定：store `ab727b67f9fd09f80c5e5c1d768b516984a70aa7`；导出 `0b943b51c212179f7519f91429163d5874061faf`；测试 `a6faf231f837dafcd21c8eeb8fb752d34388c79a`。未提交diff，无真实源/schema/UI变更。

本轮专项7/7、Node24全量295项/294PASS/0FAIL/1Windows file-symlink权限SKIP；Node22归档五文件67项/66PASS/0FAIL/1同SKIP；Windows分项build/typecheck/三文件lint/diff检查通过。旧harness历史12项含五视口与三档动效PASS，errors/warnings空。无新CI/生产/真机测试。恢复240根fixture的研究输出相等，样本不足（7个），不改10样本门槛；网页公开示例10样本是另一份fixture，不混作真实研究。

独立GPT产品审计无finding；证据复核1项LOW台账滞后已修并定点VERIFY PASS，无未解决finding。DS实际一次受限只读契约清单，GPT核对采纳；无文件/真实数据外发，无Provider改造。详见docs/HISTORY_STAGE_A.md及outputs/stage29。真实价格数量0，A未关闭；不启动B/C、不上传部署。
