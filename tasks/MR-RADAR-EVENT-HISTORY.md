# MR-RADAR-EVENT-HISTORY

2026-10-22（Asia/Shanghai）。Planner 定稿，进入 Builder。用户在上传部署任务中追加“完善一下，然后可以把radar那里的历史事件加进去”；完成后随已授权发布一起交付。

## 基线与事实
- 当前分支 codex/mr-radar-event-history；基线234347dc08ee5ac53c7eb4d0bf85793a95d83313，PR#6已合并，原候选CI661/661通过（历史依据）。工作区开始干净。
- Sites实际仍v32，上一轮包尚未保存/部署。本轮最终候选替代旧包，不称旧包已上线。
- Engine内存最多120原始信号；包含历史开关只能显示本次会话结束事件，刷新丢失。Intelligence仅对active聚合，组合身份不是持久episode身份。

## Scope / 契约
- 新增独立本机原始事件观察记录，7天/最多120条/序列化最多256000字符；按检测时间保留，按原id去重。同id生命周期更新不制造新事实，禁止将旧active强改resolved/expired。
- 当前Engine/store/gates/Intelligence/State/AI不恢复任何历史。历史保留原status，明确“上次观察时”，不表示当前状态；不重建过去组合。保留原指标、证据、来源、完整日期与生命周期更新时间。
- 历史入口直接可见，资产/市场范围与当前筛选一致，支持状态/代码筛选、有界分页及空/损坏/存储失败说明。返回的是当前图表，不能冒称历史精确定位，不覆盖手动周期。
- 仅保存在当前浏览器，不上传、不同步、不后台采集、不回补未观察事件。异常存储安全降级会话记录，不清用户偏好/自选/提醒。跨标签同步以原id/状态版本合并，不把未知内容带入当前金融事实。
- 无新provider/API/timer/依赖、无数据库/鉴权/来源许可/模型消费变更。AI仍关闭，主3.0任务开放。无实测瓶颈不进入Optimizer。

## Allowed paths / 依赖
lib/radar/event-history.ts；components/radar/use-radar.ts、use-event-history.ts、event-history.tsx、signal-card.tsx、radar-feed.tsx；app/market-radar.tsx、app/radar.css；tests/radar-event-history.test.mjs、tests/ui-components.test.mjs、tests/browser/radar.mjs；本卡、ACTIVE、RADAR、CURRENT_STATE与必要发布记录。先纯归档边界→Hook→UI→测试→GPT独立审计/FIX/VERIFY。主协调者单写，Agent只读。

## 验收
原始事件刷新保留，当前无事件仍是无事件；恢复不会提升为当前、不会改State/Alert/AI。完整证据/日期/状态可读；7天/cap/size边界、幂等、同id终态不回退active、坏JSON/未知版本/非有限数/未来数据/失败存储/跨标签、无变化不重复写入有确定性测试。五视口1440/768/390/320/844横屏、键盘、减少动效、筛选/分页/刷新、无横溢出、返回图表周期保留与存储失败；fixture明确隔离。受影响Node后build/typecheck/相关lint与集成回归，新CI验证最终候选；独立GPT审计固定diff。生产登录后和真机没有条件则NOT RUN。

## 发布
复用原Sites/public与应用门禁；正常GitHub PR/CI后合并、官方helper精确源码打包/发布。沿用发布卡MR-PUBLISH-AI30-PREPARATION，清楚区分真实AI未启用。原来源和数据track不关闭。

## 本地交付与审计

已实现本机观察归档、当前/历史切换、代码/名称搜索、生命周期筛选、12条分页、完整日期/来源/原证据、当前图表返回。不同于K线历史工作区：这里只记录网站打开期间原Engine实际输出，既往未观察事件不会回补。无新增网络请求/timer、数据库/AI调用；无变化版本不重复写入。跨标签最佳努力合并，不宣称localStorage具备数据库事务或跨设备备份。

独立GPT审计3项P2均已FIX/VERIFY：原Engine的60秒报价时钟容差需被归档往返兼容；同时间不同终态需确定性收敛；单独取最小值的detectedAt不得再参与版本排序。保留最早观察/发现时间、不同顺序/分组合并一致；独立复核6排列与收敛后0写入。最终核心SHA256 0B58ACE1D47154728DD4B3407CF3B7CA7939273C68EB7AD3F3AFB48D18192EA6。

新测：Node22.15最终678项=677PASS/1既有Windows符号链接权限SKIP；历史17项PASS（含真实Engine输出的确定性fixture），build/typecheck/受影响lintPASS。Edge149五视口历史9组、原Radar/Classic集成36组PASS，pageerrors=[]，各5条故障注入503 console记录保留；受控暂停polling的两类导航增量均0。浏览器UI结果在最后纯合并次序小修前，UI未再改变；最终小修由独立确定性复核及上述最终全量覆盖。截图与日志在忽略outputs/publish-ai30，不进入产品数据。

主client chunk相对已合并准备版840403→851467bytes（约1.3%，最后打包以实际为准），旧500KB提示保留；没有测得需Optimizer处理的瓶颈，不宣称FPS改善。没有开发DS/产品模型调用。真机和生产登录后NOT RUN；历史只在当前浏览器保存，7日/120条/容量限制，存储故障诚实降级。

状态：本地约定范围完成，等待正常GitHub CI/发布；不将主3.0真实生产AI标完成。
