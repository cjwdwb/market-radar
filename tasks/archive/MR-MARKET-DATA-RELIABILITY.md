# MR-MARKET-DATA-RELIABILITY

## 发布后补记 — 2026-11-05

用户明确批准后已随Sitesv37/source2d2d08b上传部署；PR#13/main CI各761/761、build/typecheck及独立包装VERIFY通过。下文是本地开发交接时点，旧“未发布/待授权”不代表当前状态。线上入口303/首页200后因验证相关标记停止，后续刷新仍BLOCKED/NOT RUN；来源全面恢复未确认。[发布归档](MR-PUBLISH-MARKET-RELIABILITY.md)、[专项报告](../../docs/MARKET_DATA_RELIABILITY.md)。

2026-11-05 · Local product candidate1aac399 verified; final evidence handoff in progress. Part of existing 3.0; return to MR-30-AI-PRODUCTION-DELIVERY afterward. Upload/deployment remain pending explicit authorization for this candidate.

## Baseline / authority

- Fresh GitHub fetch: main4352b732660dbfd200d629d5f6d1b3349687a6e1; CI39925525573/job120320829913 success rechecked (historical execution, not new test).
- Native Sites read confirms public v36, source84511bfdf4189db7a0495e82a52727aeb72a7401, deploymentappgdep_6adb1ab239988191a1763fe8955c36b7 succeeded/env3. No platform settings or secrets read/changed.
- Independent worktree `worktrees/reliability30`, branch `codex/mr-market-data-reliability`. Original ui30 worktree clean; other worktrees retained untouched. Current user authorizes implementation, tests, low-frequency read-only diagnostics; no new explicit authorization to push/merge/deploy this candidate or independently deploy monitor. Deliver reviewable candidate first. No AI/ledger/private files, purchase, migration or collectors.
- GPT planner/core/build/audit; optional DS has no suitable approved payload yet, actual use recorded only if called. No provider reconstruction.

## Evidence / finite issue list

| ID | Classification | Evidence / action |
|---|---|---|
| R1 | historical live, root cause UNKNOWN | 2026-10-23 BTC/ETH/SOL-USDT 1d503; Worker outcomeok, no upstream reason. Do not assume present-day failure or unique cause |
| R2 | reproduced offline | Mock403 currently dispatches4 calls across2 origins+2candle endpoints. Replace unconditional fallback and per-path rate limits |
| R3 | reproduced offline | Yahoo cachedquote t+1000ms preservesprice/timestamp but advances fetchedAt despite1physicalfetch. Preserve origin acquisition |
| R4 | code confirmed, regression tests required | Main history dropsfetchedAt; overview silently ignoresfailure; quote missingresults/partialsuccess masksfaileditems; manualhistory cache5s can suppressrefresh; trendnotmanuallyupdated |
| R5 | code confirmed, regression tests required | Candle confirmedunknown→已收盘; fixed15m Yahoo completion; displaytimezone inconsistent; range1d称当日; chartselection/gaps requireactualinteractionverification |
| R6 | code confirmed | Proxy200 streamedunvalidated; proxy401/403/429/timeout falls through to direct; abortnotpropagated; opaqueproxy maykeepworking |

## Contract 1: errors / fallback / bounded chain

Keep MarketRequestError compatible, add stable code/stage/traceId/retryAt/upstream status; public errors from fixed map, no arbitrary upstream strings/URLs/stacks. Response error string remains for compatibility, additive errorInfo. User auth401 staysgate; upstream denied→502/service diagnostics, timeout→504, rate→429, invalidrequest400, no200 empty success.

History: absolute26s deadline includingbody/queue, max4 physical directproviderattempts, eachhop≤8s; proxy≤6s sharesremainingtime. Onlytransport/transient5xx maytry existing approved fallback; deny/auth/region/429/cooldown/cancel/environment/invalididentity nevertryanotherorigin/endpoint. Provider-wide OKX cooldown retainslongestRetry-After (minimum60s). No extraorigin/provider.

Configuredproxy: validateboundedJSON+identity+currency+range+time+bars; legacyresponse maypreserve valid originalfetchedAt but mustlabel unverifiablemetadata. No directfallback afteropaqueproxyfailure/timeout/auth/rate: internal attempts/cancel UNKNOWN, avoidingparallelfanout. Unconfiguredproxy usesdirect. Monitor source-compatible change ifneeded islocalonly, no claim remoteagentpatched.

Quotes:16s absolute deadline includingqueue, boundedconcurrency≤4 forindividualstocks; perYahoo≤2transportattempts; one sharedOKXtickers≤2. Aggregatecap2×YahooCount+(OKX?2:0), max56 at28inputsymbols, not4total(such cap wouldsilentlydropvalidassets). Produce1result perrequestedasset includingfailures.

Sharedoperation: complete canonicalkey, oneunderlyingabort+deadline, waiter-specificcancellation; stopdownstreamwhenallwaitersexit; oldfinallydeletesonlyownentry. Cache/inflightbounded. Freshness doesn'tadvance onread/failedresponse. Allphases respectremainingtime/bodylimits and no new fullbudgetperfallback.

## Contract 2: streams / metadata / scheduling

Keep existinghealthy cadence: visiblequotescrypto5s/stocks15s, background60s perpreference; selectedhistory15s at15mrange/60sotherwise; cryptoanalysis/overview60svisible. No permanentnewtimer. Oneclient sharedhistory pool maps15m/1d onlyforknownUSDT15m×96equivalence; source/market/currency/interval/range-family inkey, no1H/4H/daymix. Primaryhistoryfirst; boundedoverviewworkers. Manualrefreshjoinscurrentinflight andcoversquote+chart+selectedanalysis, bypassesreadcache butnotcooldown. Autooffallowsinitial/explicitselection/manualread, noautomaticresumeorbackgroundpoll.

History: existingfields plus `metadata:HistoryMetadata`, originalfetchedAt,readAt/cacheoptional,traceId. Rootowns additive types. quote/errorstates perasset; nofalseglobalsuccessonallfail/missingitems. Preserveoldsamekeyviewwithsourcecutoff+error; failed/staleanalysisinput gatedwithoutchangingfinancialthresholds. Clientgenerationcheckedthen/catch/finally; waiterabortisnotnetworkbackoff.

## Contract 3: candle identity / integrity

Point.confirmed remains explicit sourceboolean orundefined; Yahoo `windowEnded` separateboolean, neverfalseclaimedsourceconfirmation. Fixedperiod completionusesactualinterval; Yahoo dailycompletionunknownwithoutprovensessionend. Strict positivefiniteOHLC/envelope/nonnegativevolume, declaredms/secconversion, invalidrows/duplicateconflict/gapcounts; conflictduplicates notarbitrarilylastwins. Nofill/interpolation/tickerOHLC. Sourceunknownconfirmationnotupgradedbyclock. reusePoints remainscanonicalcomparator (addwindowEnded only).

HistoryMetadata: intervalMs(number|null forcalendarunknown),bar,exchange,instrument,marketType,volumeUnit,bucketTimezone,completion(source/time_window/unknown),firstAt/lastAt,lastCompleteAt(exclusivebarEND),invalidRows/duplicateRows/gapCount,path,limitations. OKX SPOTvolume base, tickerturnover quote; configuredmapping15m/1d→15m96,1w→1H168,1m→4H180,3m→1Dutc90 preserved. Actualcoverage ≠ guaranteedfullrange. ExistingState/Signalmath andYahoo5m domainguard unchanged.

## Contract 4: range / timezone / chart

Range1m ismonth, neverminute. 1d labelrollingrecentwindowforcrypto; actualbarinterval andUTCbucket explained. Preference device/UTC/Asia/Shanghai; Intl/IANA only, stableSSR UTC labeleduntilclientzoneknown; preserveotherprefs andmemory-onlyprivatefiles. Quote/chart/tooltip/footer/currenteventtimes sharedisplaypolicy; evidenceUTC preserved. Date-specificoffsetdisambiguatesDST. Zonechangesonlyformat, nofetch/resetviewport/data.

Keepexistingcandleentry15m andlineotherranges. Chartprops receiveactualinterval/metadata; unknownconfirmationvisible. Existingpan/zoom/follow/timeanchors retained; selectionbyabsolutetime anddragappend verified. Lines/MA cannot silentlybridgeknownmissingintervals: breaksegments andrequirefullcontiguousMAwindow, do not redefineMA7/25orinjectpoints.

## Bounded real diagnosis plan

Total24 countable site/directmarketHTTPattempts, concurrency1, accumulatedbody≤8MiB, ≤10minactiveobservation, body≤2MiB/request, site≤35s/direct≤8s, noautoretries in diagnosticrunner. Reserve8before,8candidate/direct,8postpublication (postunuseduntilauthorized); stoppriorwhenbudget/bytes/deadlineexhausted oraccess/challenge/403/429 occurs forroute/provider. Assets BTC/ETH/SOL-USDT, initialrange1d(native15m), optionallyBTC15m. Allowednormalpublic `/from-aether` session only, no bypass/secretread; entrancecountsseparately, nofullappauto-fanout. DirectonlyexistingofficialOKXcandles/tickerasneeded aftercodeevidence; nopurchase/historybackfill. Recordsiteouterrequests andobservableupstreamattemptsseparately; opaqueoldsite/proxyinternalcountsUNKNOWN, notclaimedglobalcap. No productionfaultinjection. Offline+Workerfixtures externalnetworkdenied. Officialdocsreadnotmarketdatarequest.

## Allowed paths / dependency split

- Root: lib/market.ts, small lib/market-client.ts / hooks ifneeded, lib/refresh-policy.ts, app/market-radar.tsx, necessary local CSS, minimalRadar types/validitywiring, tests/browser/radar.mjs+boundeddiagnostic/runtimevalidation, tasks/ACTIVE.md+thiscard/docs/API_CONTRACTS.md/RELIABILITY.md/currentreport.
- TransportGPT independentworktree: lib/market-request.ts, lib/okx.ts, lib/market-data.ts, small historyvalidationhelper, app/api/{quotes,history}/route.ts, monitor/worker.mjs onlynecessarysamecontract, relevanttransport/route/normalizationtests. Startafterroottypesfrozencommit.
- ChartGPT independentworktree: components/candle-chart.tsx, use-chart-viewport.ts/lib/chart-viewport.ts onlyconfirmedneed; lib/market-time.ts, optionaldisplaytimecontext andcurrentRadarformatcallers; time/charttests. No mainfile or markettypes edits. Startafterroottypesfrozencommit.
- Nochangesaccessgate/AI/budget/sourceuniverse/schema/dependencies/newservices. CoordinatoralonewritesACTIVE. Nootherworktreeediting.

## Verification / audit

Per-slice affectedoffline tests (no realnetwork evenwithKey); existingdomain+alertregression; stablefullNode,typecheck/build,affectedlint; comparepreexistingmainlintdiagnostics. ActualproductionbuildWorker routefaultmatrix/proxy+gate/timeout; fiveregularviewports andrefreshsequence: partialfailure/recovery/autopause/manual/rapidasset+range/cancel,confirmboundary,selectedtime,timezone/DST/SSR,noextraquery. screenshotsbefore/afterfixeddata. Realdiagnosisreportseparatefromfixtureandoldhistory. NoFPSclaimwithoutrealclockmeasurement. Optimizeronlyreproduciblebottleneck.

IndependentGPT auditstablefulltaskdiff thenfix/VERIFY, focusing403/429bypass,chainbudget/sharedcancel/cachefetchedAt/proxyidentity/timezone/unknownconfirm/analysisfailure/permissions. Finalfourstatuses: CODE_FIX_VERIFIED, LOCAL_RUNTIME_VERIFIED, LIVE_SOURCE_CHECKED, PRODUCTION_REFRESH_VERIFIED; nofalsefullrestoreifsourceunavailable. Finalreporttenquestions,user-facingfreshnessentrypointsandremainingauthorization. This section is the original Planner contract; actual execution is recorded below.

## Execution handoff

Source/transport/chart/client and main implementation complete on the isolated branch. Independent audit97c2c3e found a P2 old-tail/fresh-acquisition display gap; fixed648010e and verified. Visual inspection identified duplicated/current-offset labels on older quotes; fixed1aac399 and independently verified against a real DST boundary using offline data. No algorithm threshold, provider, auth, private-file or AI change.

Final Node run on1aac399:761 total,760PASS,1Windows-file-symlink SKIP; build/typecheckPASS. Existing lint issues retained with baseline comparison, no new diagnostics. Local production Worker16PASS; fiveviewport behavior125PASS on648010e. Final1aac399 fiveviewport/three-state screenshots15 and no-horizontal-overflow checks15PASS;18.5s normal-clock combined observation7PASS with automatic polling/standard motion,0pageerrors/externalrequests/observedlongtasks; notFPS orphone evidence. Independent finalreport/test-diff audit on e441d28 matched raw evidence and build hash; two documentation precision corrections applied without product changes. See [full report](../../docs/MARKET_DATA_RELIABILITY.md) for actual test identities and limitations. Real prebatch3requests/11,693bytes/no retries stopped after ETH rate-limit response; do not claim source fully restored or probe around the stop.

Current production stays Sitesv36/source84511bf. No push/merge/tag/deploy, monitor deployment, secrets, purchases, collectors or model calls. Remaining release actions if separately authorized: upload candidate→candidateCI→review/merge→mainCI→same-site deployment→bounded production refresh verification; remote monitor upgrade requires its own verified version/authority. Local testing is not production recovery.
