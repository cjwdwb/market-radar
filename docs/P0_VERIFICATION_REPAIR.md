# 2.8 P0 验证修复记录

日期：2026-10-02。任务：[MR-28-P0-VERIFICATION-REPAIR](../tasks/archive/MR-28-P0-VERIFICATION-REPAIR.md)。

后续发布：用户另行要求“上传部署”后，PR #1已合入main，维护版部署为Sites v29/source `2ad04ee645ee588b16ede15c43fb093ed395419e`，main CI 288/288，平台succeeded。见[发布记录](../tasks/archive/MR-PUBLISH-HISTORY28-P0.md)。下文草稿PR/不合并/不部署是P0首次任务与续跑交接时的授权边界及证据，不是当前发布状态。

续跑状态：用户明确授权推送独立分支、建立草稿PR并完成CI。修复提交 `57b3d0f3d49383fab7a17872efb7a24c8794674f` 已上传，[草稿PR #1](https://github.com/cjwdwb/market-radar/pull/1) 的完整Ubuntu CI通过；代码与已审计8文件一致。仍不合并main、不部署、不采集真实数据。

**P0修复候选验证完成，停在草稿PR交接点。** 本地Windows、必要浏览器、独立GPT审计及GitHub Ubuntu24.04.5/Node22.15完整 `npm ci → npm test` 均有实际证据。Windows文件symlink权限项仍未测，Linux对应项已通过；不把原main的失败改写成成功，也不称修复已进入生产。

## 1. 源码、CI 与实际对象

- 基线 / 查询时 GitHub main：`27b0bab92d5e5cd5072abcdb3550d1ac9571cd1d`。
- 候选：`codex/mr-28-p0-repair`，独立工作树 `../market-radar-p0-repair`；修复57b3d0f，首个CI head为授权记录提交7b37baf。原工作树保留。审计时的UNCOMMITTED DIFF已形成上述提交。
- 当前生产发布记录：2.8 Foundation / Sites v28，源码 `75cfa0658caa6356c47e8d0c85461b3029d0fccd`。本轮没有重新发布，也没有验证生产登录后路径。
- 原审查：run [36995381868](https://github.com/cjwdwb/market-radar/actions/runs/36995381868)，job110800789451，attempt1，checkout `c97852010eb2e8926fdbfcb2a4394cf80f8cada8`，281/276/5失败/0跳过。
- 修复前main：run [36999220149](https://github.com/cjwdwb/market-radar/actions/runs/36999220149)，job110812813714，attempt1，checkout27b0bab，281/278/3失败/0跳过。
- 两次实际环境：Ubuntu24.04.5、runner2.337.0、image ubuntu-24.04 / 20260927.320.1，Node22.15.0/npm10.9.2。`npm ci` 成功，`npm test` 的 build/typecheck 成功后测试失败。两提交目标产品/测试/锁文件/CI无相关差异；后一次是文档注释提交，不能写成修复。
- 原 Windows Node24 开发通过属于历史证据，未被覆盖成 CI 通过。必要日志摘录在 `outputs/p0/evidence/{prior,latest}-ci-extract.log`；完整日志仍在相应 GitHub job。
- 修复后新测：run [37002078172](https://github.com/cjwdwb/market-radar/actions/runs/37002078172)，[job110821834479](https://github.com/cjwdwb/market-radar/actions/runs/37002078172/job/110821834479)，attempt1，2026-10-02 11:38 UTC，结论success。PR head `7b37baff07c6208da4451d2b85d058912a12393e`；实际checkout是PR合并测试提交 `0281a06585065b87e1a35f42d63e8fb782be5ef4`，其父为main27b0bab与该head。两者tree均 `34b7fa4db89ed41a0841efec38590801ade20ff2`，确认测试了修复源码，未合并main。
- 新CI实际环境：Ubuntu24.04.5，image20260927.320.1，与失败日志一致；Node22.15.0/npm10.9.2。npm ci、npm test（含build/typecheck）全部success，288 tests/288 pass/0 fail/0 skip/0 cancelled。本地摘录 `outputs/p0/evidence/pr-ci-run27-extract.log`。Actions运行时有checkout/setup-node旧Node20声明被平台改用Node24的警告；这是Action自身运行时，测试Node仍明确为22.15，不因此改workflow或混淆验证环境。

候选文件：`collector/store.mjs`、`scripts/history-local.mjs`、`scripts/prepare-history28-example.mjs`、`public/examples/history28-fixture.json`、`tests/p0-verification.test.mjs`、`tests/fixtures/p0-sqlite-lifecycle.mjs`、`tests/history28-release.test.mjs`、`tests/browser/radar.mjs`；文档为本报告、`docs/CURRENT_STATE.md`、`tasks/ACTIVE.md`、本任务卡。代码8文件SHA256清单在 `outputs/p0/candidate-manifest.json`，首轮审计清单为 `outputs/p0/audit-r1-manifest.json`；没有编造修复提交。

## 2. 三类失败与修复

### SQLite 生命周期

原三项分别保留：FED `source is guarded before HTTP; one successful page stores real receipt identity and repeats are idempotent`；history `duplicate retry, source correction and A-B-A return have distinct stable versions`；history `cutoff, native interval, OHLC, completed and universe validations reject bad bars`。原错误均为 assertIdentity 路径 `ERR_INVALID_STATE: statement has been finalized`。修复前main CI仅第二项再次失败，不抹去另外两项的间歇失败事实；新PR CI三项均通过。

Windows Node22 修复前56项定向回归53通过、3失败（FED幂等、同一assertIdentity栈的信息拒绝用例、示例）；Node24为56/56。最小内存数据库3行，临时 `prepare().iterate()` 内强制GC时 Node22第一行后失效，连接 `SELECT 1` 仍可用；显式保活statement则完整遍历。Node24两种写法均成功。该实测证明此写法在Node22的资源保活兼容问题，不声称生产数据库损坏或未经核对的官方缺陷编号。

`assertIdentity` 改为 owner/run_id keyset同步读取，每页100行，仍逐条检查source/asset身份。新增205-run测试又实际复现 `exportSnapshot` 的同类临时迭代失效，因此仅该循环改为rowid有序分页100行。保留外层事务、导出表/格式/顺序、总行数和逐行字节上限；无schema变更、异常吞掉、重建数据库或无限重试。

新增测试在身份遍历和导出各强制GC10次，覆盖三页、首尾身份冲突、owner/source隔离、回滚后再用、导出207行及空库恢复。原幂等、A→B→A、固定readRevision、原子提交、重开/恢复测试全部保留并运行。恢复停止采集仍由 `archive_meta.collection_enabled=0` 控制，不改run历史状态。新增fixture曾错误期望status=paused，已依据原契约更正为ready且collection_enabled=0；原断言未削弱。

### CLI 可移植路径

旧Linux会把 `Z:/outside.sqlite` 解析成受限根内的普通名字，Windows则视作盘符绝对路径。这是输入契约不一致，不能据此声称已经发生真实目录逃逸。

冻结规则：CLI只接受 `work/state27` 内的可移植相对名称；允许合法混合分隔符和内部 `sub/../nested`。拒绝空/非字符串、根本身、逃逸/兄弟前缀、POSIX绝对、Windows盘符绝对/相对、UNC/设备路径、ADS冒号、控制/保留字符、设备名称、末尾点/空格。原有绝对路径未被放开。

数据库/恢复输入/导出输出路径在mkdir/open前预校验；直接lstat检查断开的链接。实际Windows父级junction及dangling junction拒绝且无写入，已有数据库/备份/恢复目标不覆盖。Windows文件symlink创建返回EPERM，新用例明确SKIP（验收NOT RUN），未改变系统权限；Linux对应目录、断链及文件链接用例已在run37002078172通过。检查不构成对恶意并发更换文件系统别名的无竞态保证；工具仍为可信本地操作者使用。

### 演示数值与 digest

修复前同Windows不同运行时：Node22与已提交Node24生成样例在bar149、176共8个OHLC字段不同。首差为103.02453939278817 / 103.0245393927882。原样例digest `e3b6fd93d379ded020cc3e249541a628683cc9b8e144782abd4daaab49d35309`；旧Node22重新生成digest `7cf70ff9d016d5d78f3a01138de413e2a297c0d94e04f0e8bc87f80158e23a6d`。未关闭deepEqual或digest校验。

仅模拟生成器改为BigInt精确有理复利 `100×(10002/10000)^i`，按1e-8 USD正数半数向上取整；high/low在整数单位加减0.01，再转换Number。真实数据、parser、State/研究数学及阈值不做舍入、不放宽准入。

通过唯一函数 `createHistoryExample(1790935326955)` 重建示例，保留原exportedAt、302根5m、起点、fixture身份。没有手改digest或用今天时间重造receipt。新digest `e2ac2cbd212b20ec430a944cf7026dbc8a25f2ffd566084055df89cae127d9e7`，Node22和24均deepEqual候选样例文件，canonical完全一致。

与旧样例相比1198个OHLC字段发生有界精度变化，最大绝对价格差 `4.998142344447842e-9` USD。两窗口方向upward、RMS similar、证据端点和样本可用状态相同；仍是同10个样本时点，但距离排序变化。收益统计有极小变化，未宣称数值全不变：

| 收益率（%） | 原样例 | 新样例 |
| --- | --- | --- |
| 最小 | 0.12006001600237681 | 0.12006000775302006 |
| 中位 | 0.12006001600239902 | 0.12006001606746919 |
| 最大 | 0.12006001600239902 | 0.12006002151379036 |

原合法包完整保存在隔离 `outputs/p0/legacy-example.json`，Node解析及浏览器导入/回放/10样本研究通过。旧包不强制重签名；新旧损坏digest均拒绝并保留已接受数据与查询。

## 3. 新测命令、环境与证据

本机Windows x64 / Asia-Shanghai。Node24.19.0、V8 13.6.233.17-node.51、SQLite3.53.3。官方便携Node22.15.0、V8 12.4.254.21-node.24、SQLite3.49.1、npm10.9.2安装在隔离outputs，不改系统运行时。ZIP SHA256经官方SHASUMS核对：`06067d4f0d463f90ed803d5eca5b039a05dec5d70fc7b7cc254803a59bd0e27c`。

下表`node22`表示 `./outputs/p0/tools/node22/node-v22.15.0-win-x64/node.exe`，`types`表示 `--experimental-strip-types --import ./tests/register-types.mjs`；命令均在隔离项目执行。

| 检查 | 实际命令/范围 | 结果 | 本地证据 |
| --- | --- | --- | --- |
| 匹配CI环境 | GitHub Ubuntu24.04.5+Node22.15 `npm ci → npm test` | PASS，288/288，0失败/跳过；本机仍无Linux | run37002078172/job110821834479 |
| 隔离安装 | node22 outputs/p0/tools/node22/node-v22.15.0-win-x64/node_modules/npm/bin/npm-cli.js ci --cache outputs/p0/npm-cache --fetch-retries=1 --fetch-timeout=60000 | PASS，676包；原锁文件，PATH仅本进程指向便携Node22 | outputs/p0/npm-ci-windows22.log |
| 修复前定向 | node22 / node24 types --test：history-foundation、fed-history、history28、history28-release | FAIL 56/53/3；PASS 56/56 | outputs/p0/before-node{22,24}.log |
| 原失败及相关回归 | node22 types --test 上述四文件 + p0-verification | PASS 63项/62通过/0失败/1权限跳过 | outputs/p0/targeted-fixed-node22.log |
| 完整Node22 | node22 types --test 'tests/*.test.mjs' | PASS 288项/287通过/0失败/1权限跳过；原281全部保留，含GC与审计修正 | outputs/p0/verify-node22.log |
| 完整Node24 | node types --test 'tests/*.test.mjs' | PASS 288项/287通过/0失败/1权限跳过，审计修正后候选 | outputs/p0/verify-node24.log |
| 加强导出GC断言 | node22 types --test tests/p0-verification.test.mjs | PASS 6项/5通过/1权限跳过；其后已重新运行上两行完整suite | outputs/p0/gc-strengthened-node22.log |
| build | node22 node_modules/vinext/dist/cli.js build | PASS，有既有500KB chunk warning | outputs/p0/build-node22.log |
| typecheck | node22 scripts/typecheck.mjs | PASS（含Wrangler真实构建类型生成） | outputs/p0/typecheck-node22.log |
| 受影响lint | node22 node_modules/eslint/bin/eslint.js（7个受影响JS/test文件） | PASS，0诊断，审计修正后候选 | outputs/p0/lint-verify.log |
| 新旧数值 | node22 / node24 types outputs/p0/compare-fixed.mjs | PASS，新文件canonical相等；上述变化单列 | outputs/p0/fixed-{22.15.0,24.19.0}.json |
| 必要浏览器 | node22 types tests/browser/radar.mjs，RADAR_HISTORY28_ONLY=1 | PASS，12条检查/5视口/3档动效；errors=[]，warnings=[] | outputs/p0/browser/verification.json与截图 |
| 独立GPT审计 | 稳定完整diff、任务卡及本报告；修复后仅复核LOW与定向测试 | PASS，1项LOW已修，VERIFY无未关闭finding | outputs/p0/audit-summary.json；本报告第4节 |
| 新源码远端CI | 独立分支上传，draft PR触发现有workflow，未重跑旧提交 | PASS，head7b37baf与checkout树一致 | run37002078172；旧main失败仍保留 |

Windows缺少Bash/GNU timeout，本机实际执行现有build/typecheck/test分项；完整 `npm test` 成功发生在上述GitHub Ubuntu环境，不冒充Windows包装命令成功。未改workflow、engines、依赖/锁文件或测试glob。

审计后唯一产品修正仅涉及本机CLI设备名拒绝，浏览器/构建输入未变，因此复用本轮上述build/typecheck/browser结果；完整Node与受影响lint已在新版本复跑。不是用历史开发记录代替本轮新测。

浏览器：Edge149.0.4022.98，本地workerd生产构建、合成测试认证、禁止外网；全部价格为fixture，不读取生产Cookie或用户偏好。1440×1000、768×1024、390×844、320×740、844×390。复用既有harness，设置 `RADAR_SYNTHETIC_AUTH=1`、`RADAR_PREVIEW_URL=http://127.0.0.1:5293`、`RADAR_OUTPUT_DIR=outputs/p0/browser`、`RADAR_HISTORY28_LEGACY_EXAMPLE=outputs/p0/legacy-example.json`，PLAYWRIGHT_MODULE指向已有本机依赖。

新增下载包和旧包均实际导入、回放、研究及拒绝损坏digest；桌面冻结时钟的查询请求增量为0，仅隔离实验。五视口检查分页、键盘、44px目标、无横向溢出及返回焦点；3档动效检查部分窗口/缺端点/返回。已查看桌面和390px截图；不是iPhone或生产性能测量，不声称FPS提升。后端修改无需无关全站视觉重测。

## 4. 分工、审计与残余限制

独立GPT首轮只读审计：1项LOW，`scripts/history-local.mjs:12`遗漏COM¹、CONIN$、CONOUT$等Windows设备名。审计员实际只读调用localFile复现接受，并用Windows RtlIsDosDeviceName_U确认设备身份（返回8/12/14，普通名0）。不是已证实的目录逃逸。Builder仅补齐COM/LPT上标¹²³、CONIN$/CONOUT$及5个非法路径用例；Node22/24完整suite和lint已复测，独立VERIFY PASS，无未关闭finding。

审计员首轮实际执行Node22五文件定向63项（62通过、1权限跳过）及旧包与基线canonical、新生成与候选、digest/1198字段差/研究样本核对；审阅完整Node22/24、build/typecheck/lint、browser12条与SQLite最小复現日志。没有把主代理测试写成审计员重跑，也未访问私有归档或生产。其余无confirmed finding。

VERIFY实际运行Node22 `tests/p0-verification.test.mjs`：6项/5通过/0失败/1权限跳过；核对新候选8文件哈希，并在内存反向还原两处修正后与首轮哈希一致，确认未夹带额外功能。审阅修复后两份288项日志与lint，不声称其重跑build/browser/Linux。候选manifest SHA256：`4aec3f438a79584173c36041018ccfbbe85ae9d8b736e0130df5ef7daf7b9216`。

GPT完成Planner、根因、边界契约、全部代码/测试与集成。实际DS调用1次：现有deepseek-worker profile、deepseek/deepseek-flash，读取限定脱敏CI计数/环境，输出核对摘要；无仓库数据、工具访问、私有自选或生产凭据外发。GPT采纳核对后的事实摘要；DS超出指定输出长度、附带Node24/Linux建议未采纳。没有把配置可用当参与，没有额度节省估算。

P0：已补齐匹配Ubuntu/Node22完整npm test与修复源码CI；可称“P0修复候选验证完成、PR CI通过”。Windows文件symlink权限项未测，不用Linux结果替代Windows权限实测；原main仍是旧代码且失败记录保留。无Optimizer：本轮没有可复现性能优化目标，不以历史chunk warning扩范围。GitHub连接器缺PR写权限，续跑使用已有本机GitHub认证完成获准分支/草稿PR；凭据未输出或落盘，未改变访问设置。

P1：真实价格仍0条；正式清单、价格来源用途/费用、长期保管条件仍待确认。位置：[HISTORICAL_INTELLIGENCE](HISTORICAL_INTELLIGENCE.md)、[HISTORY_FOUNDATION](HISTORY_FOUNDATION.md)、[2.8任务](../tasks/MR-HISTORICAL-INTELLIGENCE-28.md)。无新的真实数据访问或补采。P2历史时间选择仍是现有history-workspace，P3沿用tests/performance/history28.mjs后续测量，本轮均不实施。

下一步由用户决定是否合并/发布修复；后续仅建议规划P1的一个已批准资产/来源真实链路，不在本轮启动。
