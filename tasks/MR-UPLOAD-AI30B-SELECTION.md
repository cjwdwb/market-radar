# MR-UPLOAD-AI30B-SELECTION

日期：2026-10-19。状态：上传前包装核验。

## 授权、基线与范围

用户在受控编号协议交接后明确“上传”。将已完成成果正常推送到原 `codex/mr-30b-real-provider-pilot` / Draft PR #6；不合并 main、打标签、部署、启用生产或再调用模型。只处理本项目，保留其他工作树。

- 上传前本地与远端 PR HEAD：`f31ccc12b7547937a51428057b59d0d581fdae0c`。
- 核对 main：`7d2d30f6fe466a4e746ade2b3db231b2cb13b2d4`。
- 当前生产依据既有记录仍为 Sites v32 / `4a4b7fb66ac4fc10663087b42a09e08c55804e2a`；本轮不做线上验收。
- 已有11份源码/测试文件与 `outputs/ai30b/selection-verified-files.json` 哈希一致；不重新开发 Foundation 或修改预算/输出语义。

## 允许路径与接口

上传现有候选：`lib/ai/{claim-selection,deepseek-provider,real-config,real-service}.ts`、`scripts/ai30b-pilot.mjs`、`tests/ai30b-{selection,cli,deepseek,provider}.test.mjs`、`docs/AI_PROVIDER_PILOT.md`、`tasks/MR-30B-REAL-PROVIDER-PILOT.md`。

协调者只增补 `tasks/ACTIVE.md`、`docs/CURRENT_STATE.md` 与本卡（完成后归档）。外部变更仅 GitHub 原分支和 PR 标题/正文；无新增产品接口、依赖或数据迁移。显式白名单暂存，不上传 outputs、Key、环境文件、原始响应、预算数据库、构建产物或 node_modules。

## 验收与步骤

1. Planner 核对基线、已有证据与白名单；独立 GPT Auditor 只读检查稳定 diff、敏感产物排除和报告事实。
2. 正常提交/push 至 `github` remote，更新原 Draft PR；不 force push 或更换发布分支。
3. 核对远端 HEAD/tree 与本地一致，检查新提交对应 Ubuntu / Node 22.15 CI。只有失败才进入限定修复/复测。
4. 记录产品提交、CI、审计与边界；文档收尾提交后验证最终 head，归档本卡。

复用开发阶段证据：507 Node 中506 PASS / 1既有 Windows 权限 SKIP，build/typecheck/相关 lint PASS，独立 GPT 最终 VERIFIED PASS。以上不是本轮重跑；本轮新测为包装/哈希/远端 CI。没有 UI 改动，不重复浏览器/真机验证。无性能问题，不调用 Optimizer；无开发 DS 委派或产品模型请求。

## 阶段事实

受控编号9次真实合成调用按冻结选择/组织/披露标准通过；stale 本地拒绝，0 HTTP/预留，模型质量 NOT RUN。旧协议两次 FAIL 保留；模型相对模板的增益仍未证明。原账本累计11/20次、保守费用占用 $0.0344574（非实际账单），真实市场解释与生产启用继续开放。

## 上传结果

待实际提交、推送与 CI 返回后填写，不预填通过。
