# MR-PUBLISH-PERSONAL-HISTORY

## 发布完成 — 2026-10-23

- [PR#9](https://github.com/cjwdwb/market-radar/pull/9)已正常合并，产品提交c4cf27ea2d21a32c45370441f16da280092bf076，main/部署源码d95b2ea35afc8d767ea65f3af4a7aabcdf34a497。远端CI39912770616/job120279332740，Ubuntu/Node22.15 npm test的build/typecheck与682/682 Node全部通过。
- 原网站 https://market-radar-rex.swt-aether.chatgpt.site 已发布Sitesv34；version `appgprj_6a9b9dc23584819190a31ae417863e7a~appgver_d6ca248dcdc08191a57eaebaff17bd52`；deployment `appgdep_6adb024cb80481919596ac375461f971`，原生succeeded，2026-10-23T06:44:37.243642Z，env revision3。
- 官方source helper同步精确源码并打包；gzip2,022,959bytes，SHA2564389b29473983d39c98507e23f10f7fe4466a80ea38a7ba5734748feb924720e；平台tar6,748,160bytes/46文件，内容hash a0007fa77173cd9c3c02a60daca7572d25a8137b5f433134d26292528d6deaa0。二者格式不同，不混用字节hash。
- 独立GPT最终产品VERIFY、包装VERIFIED PASS。46个文件均对应当前构建，manifest仅排版差异；无私人记录/预算/Key/SQL/脚本/测试，指定私人catalog指纹无命中。D1/R2仍null、观众public和原应用门禁不变；没有来源采集/真实Provider启用或新增模型消费。
- 网站提供浏览器本地文件阅读，私人显示文件未上传到GitHub/Sites；不是云端自动读取本机文件，也不是实时AI生成。用户登录后自行选取本地导出。候选五视口及真实保存文件的本机导入通过；生产登录后和真机未代测，原生平台成功不代替这些验证。
- 原ai30b工作树C1/C2和本地服务均保留，未混入此发布。主3.0及公开AI真实准入仍开放。后续文档收尾提交不重新部署。

下文保留规划与验证过程，早先待发布状态不代表当前生产。

2026-10-23 Planner。用户在本地页面交付后要求“上传一下我看看网站上能不能用”，授权本次网站入口上传发布；不推定真实个人资料可以公开托管或新模型消费。

## Scope

- 当前main/原工作树HEAD40c18e8，生产Sitesv33/public并有既有应用门禁。原C1/C2和本地个人服务改动保留，不混入此次发布。
- 采用独立发布checkout，从main提取最小个人历史显示契约/展示组件。网站提供用户显式选择已保存解释文件，只在浏览器内存读取和展示；刷新/清除后不保留。不上传文件、不存浏览器持久存储、不调用模型、不修改访问配置。
- 原本机12KiB已审计显示结果导出到Git忽略私人目录，交付本地文件链接。私人原档、回复、Key、账本、截图不入Git/Sites包；网站本身只发布通用reader。保留历史身份/来源/证据/A-B-C；导入文件明示本地文件、结构校验，不冒充服务端认证或当前行情。
- 单独演进此reader，不接生产D1或真实Provider。普通上传不能让本机SQLite/Node服务在Cloudflare可用。

## Allowed paths / integration

独立checkout的components/radar/personal-history.tsx、history-workspace.tsx、ai-interpretation.tsx最小展示exports；lib/ai/personal-history-contract.ts；Node/浏览器相关个人reader测试与必要fixture；tasks及docs/API_CONTRACTS/CURRENT_STATE发布记录。无原算法、后端认证、刷新、依赖/数据库/秘密变更。原ai30b仅协调者任务索引/本卡及ignored私有导出，其他成果原样保留。

## Acceptance

严格JSON<=64KiB、身份/来源/引用校验、无任意HTML/网络、不同文件/晚到读取/取消/错误保留标识、清除与刷新不留记录；历史结果不影响当前资产和手动周期。仅用户导入本地文件；有限私有导出含显示字段，不含请求/Key/账本。五视口键盘/折叠/证据、无网络上传验证。独立审计后正常GitHub push/PR CI和Sites官方helper同源构建部署，保留public+应用门禁，线上消费仍关闭。

先相关Node/构建/typecheck/浏览器，集成稳定跑全量Node及远端CI；不复用旧通过冒充新测。真实个人结果只用于本地显式集成验证，CI使用合成fixture。无瓶颈跳过Optimizer；开发DS不接收私人数据。

## 本轮新测 — 2026-10-23

- 新4项/既有19项受影响Node通过。最初一项反例fixture共享对象引用，修为仅篡改单独systemAdded副本，保留拒绝断言；产品无需改弱。全量`node --experimental-strip-types --import ./tests/register-types.mjs --test tests/*.test.mjs`：682=681PASS/1既有Windows权限SKIP，无FAIL。
- 官方build-site包装在Windows报告npm命令引号不兼容；未改部署框架，使用原有`node node_modules/vinext/dist/cli.js build`成功。`node scripts/typecheck.mjs`、6文件定向ESLint通过。未宣称npm test包装执行成功；远端CI将跑原Ubuntu/Node22.15的npm test。
- 复用browser/radar，新增RADAR_PERSONAL_WEB显式入口；临时Miniflare、测试会话、禁止外部取数、合成行情。五视口1440×1000/768×1024/390×844/320×740/844×390全部通过，键盘证据、A/B/C、无横溢、切换/取消晚到、坏文件/64KiB/过期、纯文本HTML、清除/刷新不保存、原资产和1周周期保持。所有导入0POST/0外部请求，pageerrors/warnings均空。Edge149.0.4022.98；没有真机或生产登录后验收。
- 显式operator环境路径另外读入上一轮真实已保存DTO，真实BTC记录仅在本机浏览器展示，0上传/0模型调用。私有文件未复制到本checkout；测试fixture为合成并清楚标识。
- 真实本地导出14003bytes，只含显示字段，位于原ai30b的Git忽略outputs；不包括原始K线/请求/Key/账本。用户自行选择文件，网站不会认证它为可信服务端输入。
- 文件来源/指标语义依旧是声明，不因结构校验升级PASS。模型价值UNPROVEN。开发DS0；原权威账本和生产秘密未访问/修改，新增费用0。旧chunk告警保留，无瓶颈不进入Optimizer。

独立GPT审计：确认1项P2为新入口造成旧浏览器选择器歧义，已限定原导入标签、.history-view标题和原底部导航，保留全部断言。补跑新入口+原history28：16组、10视口记录和三档动效全部通过，errors/warnings为空。Auditor独立4项Node+12组非法输入检查通过，复核最终diff/浏览器报告后VERIFY PASS，无未解决发现。未读取私人原档、无外发。GitHub CI和实际部署待补；本卡不代表主3.0生产AI完成。
