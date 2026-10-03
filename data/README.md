# 数据与验收文件索引

已发布官方资料：[`official-information.json`](published/official-information.json)为5个官方项目/产品25条版本事实，[`fed-monetary.json`](published/fed-monetary.json)为2条FED货币政策元数据。只含已审核公开字段，保留来源链接和current-vintage时间；非新闻全集、非财报。Sites v32上线，原库和备份不上传；[许可/覆盖/维护](../docs/INFORMATION_SOURCES.md)。

已发布长期日频：[coinmetrics-long20261003.json](published/coinmetrics-long20261003.json)，360699bytes，BTC/ETH各1828个真实USD日终参考价，2021-10-01至2026-10-02。沿用下方Coin Metrics / CC BY-NC4署名、非商业用途和current_vintage身份；实际取得于2026-10-03。仅公开批准的原响应与来源版本，不含SQLite、私有配置或凭据。既有命令加`long`可从本地归档重新校验导出，118页与SQLite完整对象一致；旧九月/五月批次不覆盖。已随Sites v31/sourcec28de66上线，公开包不等于原库的异地保管。详情见[当前状态](../docs/CURRENT_STATE.md)。

项目内保管与公开发布分开。可公开的两份示例位于 `public/examples`，随仓库/网站发布；原始数据库和备份仍在被Git忽略的本地目录。没有将真实价格变成fixture，也没有启用云端同步。

| 文件/位置 | 内容与身份 | 用途 / 边界 |
| --- | --- | --- |
| [history28-fixture.json](../public/examples/history28-fixture.json) | 程序生成的302根5分钟模拟OHLC，fixture/current_vintage | 导入Radar的“历史回放与研究”；无真实交易记录、无资产推荐；生成时间是执行脚本的真实时间 |
| [fed-monetary-20260923.json](../public/examples/fed-monetary-20260923.json) | 既有真实FED公开元数据，2条2026-09-16发布记录；2026-09-23 CST导出 | 导入“官方宏观资料”；Source: Board of Governors of the Federal Reserve System。原链接与时间保留，不代表当前RSS、完整九月或个股新闻 |
| [history28验收摘要](../docs/evidence/history28/verification.json) | 脱敏本地fixture/桌面模拟检查摘要 | 不代替真实行情、生产登录或真机验收；详细范围见历史智能报告 |
| `work/state27/fed-monetary/` | 现有SQLite、备份及公开视图；本地、Git忽略 | 原位保留，兼容既有runner，不随部署上传；本轮未移动/删除或新增采集 |
| `data/local/` | 本地资料预留目录；仅占位文件受Git管理 | 可存个人名单/新导出；不放在public，不放生产密钥；现有runner不会自动读取此目录 |
| `outputs/history28/` | 原始开发日志、截图、性能记录 | Git忽略；已挑选适合公开的结果放docs，未整体上传 |

FED元数据沿用已核验的来源范围及归属：[官方使用说明](https://www.federalreserve.gov/disclaimer.htm)。文件无文章全文、个人名单、提醒、owner/run、Cookie或凭据；数据校验和不等于官方签名。来源内容不构成本站对价格变化原因的解释。

模拟文件生成：`node --experimental-strip-types scripts/prepare-history28-example.mjs`。脚本只创建这一份明确的示例，真实generated/exportedAt取执行时钟，不伪造过去的采集时间。不会修改任何数据库或真实来源。文件可通过 `parseHistoryPackage` 校验。

**保管限制：** 项目内文件不等于异地备份或持续历史服务。请为本地数据库设置项目目录之外的备份目标与保留期限；本轮没有这些条件，不能称正式恢复/长期保管完成。个人名单、合法价格来源、费用和真实回补仍由原2.8任务跟踪。

## 获准真实日频网站资料（本地候选，未部署）

[data/published/coinmetrics-sep2026.json](published/coinmetrics-sep2026.json) 为 Coin Metrics Community API 的 BTC/ETH、USD/PriceUSD/1d，2026-09-01 至09-30各30条；reconstructed/current_vintage，真实取得于2026-10-03，不是原生OHLC或历史当时可知资料。Data: [Coin Metrics](https://gitbook-docs.coinmetrics.io/packages/coin-metrics-community-data)，[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/)，免费非商业署名展示；仅提取日期/价格、筛选批准月份，许可与代码分开，无来源担保。

此6445bytes发布包只有公开原响应、原版本及导出时间，服务端固定只读查询；不含个人名单/提醒/数据库/密钥。导出命令：node --experimental-strip-types --import ./scripts/register-types.mjs scripts/publish-reference.mjs（依赖本机批准库；无参数、无联网、重复验证不覆盖不同版本）。数据库和完整账本不入Git。详情见[本片任务](../tasks/MR-29-PUBLIC-REFERENCE.md)。

本轮已额外存一份项目外同机副本并空库恢复，未落实异地位置/保留期限；不能将这次恢复演练写成长期保管或持续服务完成。

2026-10-03更新：上述批准九月日频网站查询已随Sites v30/source749c727上线；本机原库、完整备份未上传，分钟研究/长期目标未完成。[发布记录](../tasks/archive/MR-PUBLISH-REFERENCE29.md)。
