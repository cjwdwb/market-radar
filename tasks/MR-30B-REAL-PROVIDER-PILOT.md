# MR-30B-REAL-PROVIDER-PILOT

2026-10-08，承接3.0A，不重建Foundation。阶段：离线实现/验证与独立审计完成；真实合成试点已获准，Key待用户安全配置，任务保持开放。[本轮报告与运行手册](../docs/AI_PROVIDER_PILOT.md)。

## 基线与边界

GitHub PR#5在2026-10-08 08:38:33 UTC合并；main `7d2d30f6fe466a4e746ade2b3db231b2cb13b2d4`，tree `5bb8c8286636206df36bbd5d2349317a1445d26a`。main CI37751192029 success重新核对。独立worktrees/ai30b、codex/mr-30b-real-provider-pilot；起点干净。旧分钟工作树不修改。生产记录仍Sites v32/source4a4b7fb，未新部署；历史418测试不计本轮新测。

用户补充覆盖原模型/$5预算：gpt-6-luna、Standard、none、并发1、重试0、无工具。UTC自然月项目总预算$8，dispatch≤$7，试点≤20请求且≤$0.25。所有调用者/环境共用项目根data/local/ai-product-budget.sqlite；不以scope或进程分账。此前产品真实调用0；开发DS/Codex等费用单列。

用户本轮明确答复“允许合成试点，稍后安全配置 Key”。仅自有合成资料外发和该上限消费；不包括真实行情、充值、生产配置或发布。本机process/user OPENAI_API_KEY存在性均false；不读/输出密钥。未获Key时真实调用NOT RUN。

## 最小差异与契约

|Foundation差异|本轮最小实现|
|---|---|
|fixture-only Provider/usage/result|保留旧路径；新增固定OpenAI Responses适配及独立real-pilot结果契约；requested/returned model、response id、真实usage、未知费用分开|
|单证据claimFor|保留v1；v2只支持可枚举事实绑定、跨窗口/方向与RMS关系的受限句子综合；不接受自由金融断言。mandatory限制由服务端完整展示；质量收益单独评估|
|内存FixtureBudget|新增Node SQLite持久原子预留，完整请求/schema/output最大费用，未知不退回；账本不存在/损坏/不可写时fail closed，显式初始化；并发跨进程1|
|浏览器Context无信任|不升权浏览器事实；受控snapshot registry绑定scope/symbol/版本/有效期，按每字段用途剔除。真实来源推理/展示权利未批准，B真实输入BLOCKED，准备最小接入契约，不偷偷发市场数据|

## 模型及成本

官方2026-10-08核查：[Luna](https://developers.openai.com/api/docs/models/gpt-6-luna)、[价格](https://developers.openai.com/api/docs/pricing)：短上下文Standard input $0.10/M、cached $0.01/M、cache write $0.125/M、output $0.50/M；Responses/Structured Outputs/none支持。账号可用性未验证。固定全球endpoint，不区域premium；保守按全部input cache-write价，不假定命中。额外账单/税费未知，首次执行前须有账户可用的费用上界；预留倍率至少2，不能把估算当实际账单。完整序列化payload≤32KiB，输入tokens保守按UTF-8 bytes+2048包装余量，maxoutput2048，response≤64KiB，30秒，缓存16/60秒，无自动续写。

## 切片与允许路径

A：lib/ai/{real-config,real-output,openai-provider,real-service,snapshot}.ts，lib/ai/product-budget.mjs，scripts/ai30b-pilot.mjs，tests/ai30b-*.test.mjs。不改金融分类、旧v1校验、刷新与访问门禁。不新增依赖。账本与结果在忽略的data/local/outputs保存，不提交凭据/原始真实行情。

B：lib/ai/snapshot.ts实现最低受控snapshot/用途契约；loader候选复用lib/market-data.ts的getQuote/getHistory与既有缓存/在途去重，未配置真实loader或权限。现有State函数复用，不复制金融数学、不为未知许可执行真实请求。A质量和真实字段许可满足后才接当前市场案例；没有条件不扩fixture。

C：沿用现有解释UI与共享Hook，必要模式/预算失败说明；真实试点由本地受控CLI触发，不给公开网站真实API入口。无Key网站原行情正常、fixture原路径保留。

验证补充允许tests/browser/radar.mjs：复用既有loopback入口，RADAR_AI30B=1仅添加两种预算错误态，不改变本地harness的生产禁用保护。文档：tasks/ACTIVE.md（协调者单写）、docs/{CURRENT_STATE,AI_FOUNDATION,AI_PROVIDER_PILOT}.md及本卡。新UI只有实际新增能力所需时才接，不先造真实解释空壳。

## 验证与停止

先专项mock Responses/严格schema/错误usage/拒绝/incomplete/断流，负向证据与单位/窗口/数字/冲突遗漏，未知权限与snapshot失效，账本并发/跨进程/月切换/腐坏/失败预留/重复结算。合成场景沿用10类，固定fingerprint/预期/禁止结论；stale可正确拒绝而不凑请求。

稳定后全量Node、build/typecheck、受影响lint；沿用五视口harness检查原解释/未配置/预算说明、键盘与动效。没有新UI则不虚构新增真实模式通过。远端候选CI/真机/生产NOT RUN，无上传授权。无性能瓶颈跳过Optimizer。实际付费前定点独立GPT审查预算/语义/外发；最终稳定diff独立审计与FIX/VERIFY。DS可承担仅合成契约普通测试盘点，外发只限获准低风险内容；实际调用另记。

第一实际请求须先核Key、费用/账号边界，跑一个合成场景记录响应/usage/预留与校验；通过才继续冻结10类，关键语义错误暂停，最多一次依据明确的修正，仍计原预算。无Key则完整代码/离线证据交接，真实合成质量NOT RUN；B权限/实际当前解释BLOCKED；生产关闭。不得push/merge/tag/deploy、修改密钥、历史采购/采集或扩模型。

## 实际交接（不关闭真实阶段）

31/31专项、449项全量（448PASS/0FAIL/1既有Windows权限SKIP）、最终build/typecheck、受影响lint及五视口8组均为本轮新测。浏览器pageerror为空，两条预期429 console错误如实保留。没有完整npm test包装命令、新候选CI、生产或真机结果。主chunk825987bytes，对照825848为历史证据，无实测性能瓶颈，不进入Optimizer改动。

独立GPT两项P2（不匹配模型按低价结算、snapshot基准时效）已修并VERIFIED PASS；P3浏览器条件按钮选择器仅修测试，8组最终通过。最后18文件SHA/完整diff/报告证据只读复核VERIFIED PASS，无新增confirmed finding；最后复核未重跑全套或浏览器，也未验证真实模型/生产。DS一次外发审批拒绝后用户明确批准具体文字，再实际调用deepseek-flash一次/报告3013tokens，仅测试草案；GPT拒绝未知费用取消后退款建议，没有外发代码/行情。

产品API请求0、当月/试点已结算及未知预留0；单一项目账本位于project-root/data/local，显式初始化已完成，普通启动不重置。十类合成manifest已冻结，真实质量NOT RUN。默认真实来源rights为空，snapshot loader未接入；B真实输入BLOCKED。C保持既有fixture/未配置路径，真实Provider结果尚未接公开UI。待Key安全配置与费用/账号核验后执行已有授权合成试点；未获准真实市场外发或发布。
