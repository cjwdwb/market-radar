# MR-PUBLISH-AI30-PREPARATION

## 最终发布 — 2026-10-22

完成并归档。用户追加历史事件后，原旧准备包未发布；最终发布包含PR#6准备代码和PR#7本机历史事件，真实AI保持关闭。PR#7 CI39748374641/job119722423182的build/typecheck及678/678 Node通过，源码6f7e1e889e5b714bd3f26ffd560126bd5ea01cbe，tree6fd1917cfab3d678dcb0d4d32fc8458138dc8136。官方helper正常同步同源构建，GitHub与Sites均已完成；没有force/tag/新产品版本号。

- 原网址：https://market-radar-rex.swt-aether.chatgpt.site
- Sites v33：`appgprj_6a9b9dc23584819190a31ae417863e7a~appgver_7b2c98f99ac881918051373527865778`
- 部署：`appgdep_6ad9caf6e7c08191b4265e27256855bc`，原生`succeeded`，2026-10-22T08:36:17.573180Z，env revision3。
- 本地gzip包2,015,713bytes，SHA256 `3D6F359E4339E8B4F326ED694D77E1FE90B8D86E840392895F7313E30EC8CE04`；平台解包tar6,727,680bytes/46文件，内容hash `1ee77827cf9de1ed69e11fb6e6c929a3148407ba3bacd5da00ca6e95bf8c0a56`。两者编码不同，不混作同一字节hash。
- 最终独立包装审计VERIFIED：文件与发布checkout一致（hosting仅换行差异），无秘密/账本/原始回复/内部测试或SQL迁移；D1/R2仍null，公网真实Provider关闭，访问策略不变。
- 发布前历史专项及集成五视口9+36组通过；最终本地678=677PASS/1既有权限SKIP，远端678全部PASS。新AI真实市场、生产登录后和真机未测；开发DS/产品模型调用均0。无D1真实迁入、秘密修改、来源采集或费用。
- 后续本卡与版本索引为文档收尾提交，不重新部署。上一个可用回退点为Sitesv32/source4a4b7fb66ac4fc10663087b42a09e08c55804e2a，未执行回退。完整3.0仍开放，来源答复/真实用途/生产消费条件不因本次关闭状态发布而通过。

下文为原规划与过程记录，非当前生产状态。

2026-10-22续接：PR#6已合并为234347dc08ee5ac53c7eb4d0bf85793a95d83313，PR CI39628324304新测661/661通过。旧包独立审计VERIFIED，但未save/deploy。用户随后追加Radar历史事件，发布改为包含[历史任务](MR-RADAR-EVENT-HISTORY.md)的最终候选；旧site-v33.tar.gz不发布，生产此时仍v32。下方为上一轮过程记录。

2026-10-21（Asia/Shanghai）。状态：执行中。用户在本地交接后明确“上传部署吧”。本卡只发布当前已验证候选，真实AI消费继续关闭；不将本卡完成等同MR-30-AI-PRODUCTION-DELIVERY完成。

## Scope / 基线

- 原分支codex/mr-30b-real-provider-pilot，HEAD cd902372c3c14b67d5b16b668b28849bbfd84231，PR#6 open/Draft；main7d2d30f6fe466a4e746ade2b3db231b2cb13b2d4。
- 33个本地已有改动完整保留，包含Real Context准备和B1/C0/B2隔离准备；上轮最终661项=660PASS/1Windows权限SKIP，构建/typecheck/lint与独立FIX/VERIFY已完成，是复用证据。
- 新核对现有Sitesv32/public，原应用门禁、数据库/秘密/观众设置不变。发布源码基线4a4b7fb66ac4fc10663087b42a09e08c55804e2a。
- 本次明确授权正常commit/push、原PR审查转Ready/CI后正常merge、原Site发布。没有授权真实行情外发、开通模型消费、购买、资源迁移、密钥配置或调度；这些也不是本次关闭状态候选发布的依赖。

## 流程 / Allowed paths

协调者仅修改本卡、ACTIVE、CURRENT_STATE、AI_PROVIDER_PILOT及必要版本/变更记录；上传现有33条精确白名单，除审计确认问题不改产品。发布独立目录仅由Sites官方source helper打开与同步，不覆盖ai30b或其他工作树。Git正常快进与PR合并，不reset/clean/force。

独立GPT Auditor复核从生产到候选的默认关闭、前后端导入、部署manifest及敏感产物排除。完成实际本地AI关闭/fixture浏览器回归；运行新提交GitHub CI（build/typecheck/全Node），不把旧CI当新提交通过。无瓶颈不进入Optimizer；无外发资料给开发DS。原模型账本和Key不读取/写入。

使用Sites官方helper同步精确源码、构建/打包；能打包则上传archive，工具明确支持且本地打包失败才使用远程构建fallback。保留现有project_id与public观众，不设置D1/r2/秘密；部署后检查返回实际版本/源码/状态。匿名可达不代替登录后验收，真机未测明确记录。关闭状态发布不触发模型调用。

## 验收与停止点

发布包不得含outputs、data/local、预算库、Key、环境实值、原始Provider回复；原来源/用途Gate、真实入口关闭和私有资料边界不变。CI/确认审计问题修复后才部署。最终分别记录GitHub提交/CI/合并、Sites版本/source/deployment、浏览器及生产实际检查范围，明确“准备代码已发布；真实AI未启用”。主3.0交付任务及来源询问待办继续开放。

## 发布前新测

独立GPT从生产4a4b7fb到候选及本地成果审查，无发布阻断finding；独立3项负向测试通过（Node24），确认公网真实入口关闭、默认来源拒绝/0loader、真实准入不能借fixture绕过。前端与Worker构建不含真实Provider/账本/迁移实现；hosting无D1和迁移。全部34文件显式白名单暂存，未包含运行资料。暂存检查发现real-context-policy.ts末尾多一空行，仅删除该空行，无语义改变；其余产品保持原审版本。

本轮Edge149本地workerd新测两套既有浏览器入口：私有mock五视口6组、Foundation/合成五视口8组均PASS，pageerrors=[]。视口1440×1000、768×1024、390×844、320×740、844×390；合成身份/行情、Worker外连禁用。console保留故意注入的503及预算429反馈，不声称无warning；真实模型/真机/生产登录后均未测。日志和截图在忽略outputs/publish-ai30，仅用作模拟界面证据。

Sites原生helper已在独立publish30-site-open2正常打开v32源码，保留完整opening结果。首次沙箱网络拒绝和其后目录所有者差异已定位；仅对本次进程的精确发布目录设Git safe.directory后成功，不改全局Git或原工作树。失败的publish30-site目录保留，未reset/clean。
