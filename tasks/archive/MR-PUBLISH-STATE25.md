# MR-PUBLISH-STATE25

2026-09-22。发布成功。用户明确授权“发布上传”。

## Goal / baseline

将已经本地验收和独立审计的2.5方向结构/RMS波动对比，以及MR-STATE25-REFINE局部精修，提交到cjwdwb/market-radar并发布同一源码到现有Sites项目。补齐README/CHANGELOG/版本索引和发布记录。

GitHub main本轮API读回与本地HEAD均为8a79166512d26d958c5ad380b2e3977cb2265d1f。分支codex/mr-state25-refine，19项已有修改/新增均为此前2.5与精修成果，全部保留。现有生产2.45/Sites v22，源码6804b41f5c6763cc631c9919e24e93fd6a076bbc；Sites本轮读取仍public，环境revision3，既有访问码密钥已配置（仅核对key/secret元数据）。

## Scope / allowed paths

发布已有app/components/lib/tests变更，不再修改产品代码。允许README.md、CHANGELOG.md、docs/CURRENT_STATE.md、docs/VERSIONS.md、必要文档中的发布状态、tasks/ACTIVE.md及本任务卡/归档。忽略目录中的证据/打包文件不提交。无API/依赖/schema/认证/生产环境配置变更。旧QA-A按用户决定不阻塞，不改成PASS。

## Validation / acceptance

核对当前候选文件hash与上轮验收快照一致，复用最终99 Node、build/typecheck、9专项与独立VERIFY；62综合浏览器为最后LOW修复前记录，不能称本轮重测。本轮仅文档整理，不重复全量产品测试。Sites官方工作流核对源仓、打包；本地无法打包时仅使用工具明确支持的remote build fallback，不上传旧产物。

Git提交与GitHub main普通快进；新增不可移动radar-v2.5标签，发布终态成功后新增实际sites-vNN。不得强推。Sites复用现有project_id/受众/密钥，精确commit保存版本后部署，succeeded+URL为发布验收。GitHub读回main与标签确认；生产登录后/真机验证不冒称已完成。发布文档后续提交不等于重部署。

## Execution

源码提交31a11d2d5006e10edeb4907fe8a7cafb22ca6960，GitHub main普通快进推送成功；radar-v2.5新增标签推送成功，git ls-remote读回二者SHA一致。核验12个关键产品/测试文件的SHA256与已有验收快照一致，git diff --check通过；本次没有重复全量产品测试。

Sites官方open成功核对原源仓；publish遇到间歇性TLS错误，其中一次push后的ls-remote失败。未关证书校验、未持久写Git连接配置。官方package-site在沙箱内/外均报Unable to start the Sites workflow command，本机无可用Bash；按工具支持的remote build fallback保存精确源码，平台已确认source与31a11d2一致，不上传旧产物。

Sites v23：appgprj_6a9b9dc23584819190a31ae417863e7a~appgver_f5ebdcc5134881919c4b15a7f146955c。Deployment：appgdep_6ab24a44e6908191be10f2eae84ed04d。平台终态succeeded，2026-09-22T09:30:29.007427+00:00，环境revision3。正式网址：https://market-radar-rex.swt-aether.chatgpt.site 。临时凭据只保存在会话内并经隐藏stdin传递，未落盘或写入remote URL。

无产品新增，Optimizer跳过；产品独立审计复用原报告，发布元数据由协调者核验。未进行生产登录后/真机补测，不把平台发布状态当作真实行情或操作路径验收。

## Completion / source identity

产品标签radar-v2.5与发布标签sites-v23均标记31a11d2d5006e10edeb4907fe8a7cafb22ca6960。本记录、README及版本索引随后以单独文档提交上传GitHub，产品代码无变化，不重新部署。原开发归档的“未上传/未部署”为当时阶段记录，本轮发布授权与结果以本报告为准。网站受众public及应用访问码、密钥、数据库保持原状。
