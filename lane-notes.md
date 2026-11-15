STATE RUNNING 2026-11-15T08:40Z | merged today 18 (#81 #68 #72 #74-#80 #86-#92) | open work PRs 0 (+ #84 #85 never merge) | open issues 9 | in work: #35 (docs to the decided scope)
mission: プランに書いてある作業をやること。まず既存の PR を本質的に対処する（handoff #84 の続きから）
model fable (lead, owner order relayed 2026-11-15: 「Opus使ってるところはfableチケット使いたいからfableに変えて。」; reviewers and implementers fable, mechanical steps sonnet) | advisor unknown | github via connector (gh token invalid) | push via git | png ok
goal: lane to DONE or DONE-WAITING or PAUSE | DONE-WAITING satisfies it: yes
repo rules read: README, docs/, .githooks/pre-push (npm run scan:public), .github/workflows (all manual), no CLAUDE.md/AGENTS.md, no PR template; stricter ones: public-content rules (.github/public-content-rules.json)
DEPLOY | merge to codex/initial-implementation -> nothing | evidence .github/workflows/verify.yml:3 (workflow_dispatch only; deploy job needs inputs.deploy) + check runs on merged head 41bcc71 show only CodeRabbit (no hosting-platform build check)
---
START 2026-11-15T01:10Z | lane course-library [cloud] | night order of 2026-11-15 JST | one subagent at a time
handoff: PR #84 comment 6879098140 | next: land #81 (+#64, closes #73), check main, #68, #72, then #74-#80 against the design page
design page: https://claude.ai/artifact/2w1NZVNcQFAgkAVjFqjAcQ opens from this container (12 boards)
worktree /workspace/course-library claude/course-library-cloud-messaging-vrv4qr clean (equals default head cb6235b)
plan rows: none in first message (written under for main session); working the open PRs
CYCLE 1 T=2026-11-15T01:20Z | PRs 12 (11 workable + handoff #84) | issues 27 | ledger rows 0 | list: cycle-1.tsv
MANAGER 2026-11-15T01:27Z (fable, high) policy:
- order: #81 (carries #64) -> #68 (retarget to default) -> #72 -> stack 1 (#74 #75 #76 #77) -> stack 2 (#78 #79 #80); #84/#85 untouched
- stacks: land one by one bottom-up; retarget to default, merge default into the branch, check on that head, merge commit (not squash)
- design difference caused by the PR: fix inside the PR before review; difference already on default: one separate conformance PR over all 12 boards after the stacks; elements not in the design: build from existing design components, list as "not in design" in the body
- #78: keep the design copy on entry and footer (design board Main fixes it); land only product-holder wording and per-course footer version; #42/#43 stay open for the owner
- stop rule: one fix round per PR; a second failure parks it and everything above it
- after PRs: conformance PR (fold #58) -> #30 test:browser -> follow-up 1 (duplicate hash = broken config) -> follow-up 3 (61 s test) -> follow-up 2 (Secrets type) -> follow-up 4 (grammar) -> close parent stories fully met
PASS LINE: a fail closed (gift phrase never opens product, nor reverse; nothing before auth) | b no real data | c test fails on base, passes on head, check green on exact head, no test weakened | d body matches diff, one purpose, closes only what is finished | e design: side-by-side per touched board at 1440 and 390, same state, identical where the design shows it | f hygiene unchanged (no-store/Vary/CSP/cookie flags, CSRF/Origin, rate limit before phrase check, no logging, no external resource, works without JS) | g copy consistent, no survey wording on product-only views, no unkept promise | h no production effect (no workflow/wrangler/approval-flag change), docs updated
DECIDED | lead runs `npm run check` and renders evidence inline instead of spawning a Sonnet member | reason: one-subagent cap and cost per landed PR; these are single commands | revert: brief a sonnet member for them
DECIDED | second review identity: none required | reason: CodeRabbit and Codex bots are rate-limited and merged PRs #59-#83 carry no bot approval | revert: wait for bot approval before merge
81 | LAND | merged 5aeb8f3 (carries #64) | 7f8e2f6 | local 75/0 | https://github.com/kouiso/course-library/pull/81#issuecomment-6887198261 | merged 01:17Z
68 | LAND | retargeted to default, base merged, merged 5479a50 | 50e1bf2 | local 76/0 | https://github.com/kouiso/course-library/pull/68#issuecomment-6887229999 | merged
72 | LAND | base merged (manifest.ts conflict: both sides kept), merged 28c4c27 | c50eb74 | local 78/0 | https://github.com/kouiso/course-library/pull/72#issuecomment-6887257557 | merged
74 | FINISH | retargeted, base merged (index.ts import conflict: union) | 91bc5eb | local 80/0 | - | waits for design compare + review
75 76 77 | FINISH | stack merged upward (76: index.ts import conflict: union) | cb3be3d f49e6e5 1c0641d | local 81/0 82/0 82/0 | - | wait for #74
DECIDED | lead resolves import-only / keep-both merge conflicts inline | reason: 2-line mechanical unions; an implementer round costs more than the fix | revert: hand conflicts to an opus member
MEMBER 2026-11-15T01:30Z opus: building tools/design-compare.cjs (design board left, real screen right) + baseline against default; blocker-first item for #74-#80 and the conformance PR
follow-ups recorded from reviews (each a separate PR): (5) #81 want: delivery sentence in manifest.ts:32 claims a check that the repo does not have; (6) #68 wants: check-release.mjs reads giftPolicy/productPolicy directly, validateManifest should reject a shared approval object, `approval` missing -> TypeError (use ?. === true); (7) #72 wants: bundle box shown without links below level 10, SETUP.md lacks the _01.._10 settings, validateManifest's 3 new checks have no tests
MEMBER done 2026-11-15T01:32Z | tools/design-compare.cjs on notes branch (12 boards, ~12 s) | baseline evidence/design-default-28c4c27/ (images + diff.md)
design baseline, default 28c4c27 vs design (for the conformance PR): global line-height 1.8 makes header, inputs, buttons, download rows taller on every screen (Library 1651px vs 1100, Course 2221 vs 1905); Library: badge/button copy, extra paid-product section and close button; Course: "第01章" vs "第1章", "練習問題 NN" vs "問題 NN" (mobile), bundle label, extra verification paragraph; footer version 0.2.2-synthetic vs 0.2.x; mobile footer bookmark note. Screens with no board: /guide, /status, locked course (403), paid product page, message pages (401/403/404/421/429), config-error 503, 404 preparing.
design check #74-#77: diff.md identical to default on all 12 boards for each head (evidence/design-74-91bc5eb, -75-cb3be3d, -76-f49e6e5, -77-1c0641d)
DECIDED | one freshly spawned reviewer returns four separate REVIEW records for the stacked #74-#77 | reason: one-subagent cap and cost; each PR still gets its own record against its own diff and head | revert: one reviewer per PR
HOUR 2026-11-15T01:40Z | merged 3 | closed 3 | fixed 0 | blocked: PAUSE (allowance guard); #74-#77 reviewed PASS, not yet posted or merged
HANDOFF 2026-11-15T01:40Z (PAUSE from managing session)
- next item: #74. Its REVIEW text (PASS, must 0) is in reviews/74-77.md on this branch together with #75 #76 #77 (all PASS, must 0). Per PR, in order 74 -> 75 -> 76 -> 77: post REVIEW (word for word), LOCAL-CHECK with evidence/<pr>-<sha>.png plus design link evidence/design-<pr>-<sha>/, GATE, merge (merge commit, expected head). #74 is already retargeted to default; retarget #75 #76 #77 to default after the one below lands (heads already contain the layer below, no new commit needed).
  heads: #74 91bc5eb (80/0) | #75 cb3be3d (81/0) | #76 f49e6e5 (82/0) | #77 1c0641d (82/0); all pushed
- then stack 2: #78 needs rework by an implementer (manager: keep the design copy on entry and footer, land only product-holder wording and per-course footer version; merge fix/45 top / default into it, views.ts conflicts), then #79, #80; run tools/design-compare.cjs on each head
- then: design conformance PR over all 12 boards (baseline evidence/design-default-28c4c27/diff.md; fold #58), #30 test:browser, follow-ups 1,3,2,4 and review follow-ups 5-7 above, close parent stories fully met (#22 #27 #28 #29 #32 #45 #48 #49 #50 #56 to verify)
- open queues: LAND 4 (#74-#77, reviewed) | FIX 1 (#78) | FINISH 2 (#79 #80) | issues 24 open, unsorted
- owner list: see needs owner | device: none
- members still running: none (manager agent id a5da30e4e548e559a may not survive; decisions are above)
- container worktrees: /workspace/w74..w78, /workspace/wcmp, /workspace/notes; nothing unpushed
HANDOFF 2026-11-15 (cleanup hearing; lane handed to the personal-account manager; no merge, no new work after this line)
- repositories touched: kouiso/course-library only
- branches this lane created: notes/course-library (PR #85, draft, never merge). Branches this lane pushed merge commits to (created by the previous lane): fix/product-version-single-source? no (merged as it was) | chore/39-collection-approval (merged, #68) | feat/gift-chapter-phrases (merged, #72) | fix/48-entry-expiry (#74 open) | fix/29-logout-without-session (#75 open) | fix/50-key-screen-button (#76 open) | fix/45-basic-auth-hint (#77 open). Session branch claude/course-library-cloud-messaging-vrv4qr: never pushed to, no commits.
- merged by this lane: #81 (5aeb8f3, carried #64), #68 (5479a50), #72 (28c4c27). PR bases changed: #68 and #74 retargeted to codex/initial-implementation.
- in flight: nothing uncommitted, nothing unpushed, no job or subagent running. Half-done step: reviews of #74-#77 are PASS but only stored in reviews/74-77.md, not posted on the PRs; no LOCAL-CHECK/GATE comment posted on them yet.
- exact next step per open PR:
  #74 head 91bc5eb: post REVIEW from reviews/74-77.md, LOCAL-CHECK (evidence/74-91bc5eb.png, 80/0, design evidence/design-74-91bc5eb/), GATE, merge with a merge commit
  #75 head cb3be3d (81/0): after #74 lands retarget base to default, then the same four steps
  #76 head f49e6e5 (82/0): after #75, the same
  #77 head 1c0641d (82/0): after #76, the same
  #78 head 1fcd677 (untouched by this lane): rework so entry and footer keep the design copy; merge default in (src/views.ts conflicts); compare with tools/design-compare.cjs; review
  #79 head 6016f5a, #80 head 6c705a2 (untouched): after #78, merge the layer below in, check, compare, review
  #84 handoff PR of the previous lane, #85 notes PR: never merge or close
- planned next after the PRs: design conformance PR over the 12 boards, #30, follow-ups 1-7, closing parent stories that are fully met (list above)
- could not be pushed: nothing
- note: this block was written before this lane saw the personal-account session's commits 2eea4f9..0688c25 ("stack 1 landed"); where the two differ about #74-#77, the personal-account lines are the current state

MOVED to personal account 2026-11-15T05:05Z
START 2026-11-15T05:05Z | lead opus | one subagent at a time | handoff: HANDOFF 01:40Z above, next #74
worktree /home/user/course-library claude/course-library-cloud-messaging-exayv3 clean | /home/user/notes notes/course-library clean

74 | LAND | CodeRabbit valid finding (duplicate/empty login cookie -> 200) fixed by lead + test + notice-template copy; fresh opus review PASS | 749ca6c | local 80/0 | https://github.com/kouiso/course-library/pull/74#issuecomment-6889558471 | merged e95176f
75 | LAND | base merged, base-only REVIEW line, retargeted | c50733f | local 81/0 | https://github.com/kouiso/course-library/pull/75#issuecomment-6889615021 | merged a0a7fb0
76 | LAND | same | 7692b5d | local 82/0 | https://github.com/kouiso/course-library/pull/76#issuecomment-6889615477 | merged 3555339
77 | LAND | same | f6937ec | local 82/0 | https://github.com/kouiso/course-library/pull/77#issuecomment-6889615930 | merged 37e0d30 (issues #48 #49 #29 #45 closed by merge)
DECIDED | lead fixed the 3-line CodeRabbit finding on #74 itself, then a fresh opus reviewer reviewed the whole PR | reason: one-subagent cap; one implementer round costs more than the fix | revert: hand such fixes to an opus implementer
queues 05:16Z: LAND 4->0 | FIX 1 (#78) | FINISH 2 (#79 #80) | next: #78 rework by opus implementer

HOUR 2026-11-15T06:36Z | merged 4 (#74 #75 #76 #77) | closed 4 issues by merge (#48 #49 #29 #45) | fixed 1 (#74 CodeRabbit finding) | blocked: none; worker restart 05:20-06:30Z cost an hour | open PR 6->2 workable (#78 in rework, #79 #80) | open issues 19 | iteration board: none (.github/scrum-board.yml absent) | skipped (-ux): 0
design boards fetched from the design page to /home/user/design (12 boards); tools/design-compare.cjs reproduces the 28c4c27 baseline on default 37e0d30
MEMBER 2026-11-15T06:35Z opus implementer: #78 rework per manager decision (design copy on entry/header/footer; land buyer-only hero, hidden locked-gift description, per-course footer version; Refs #42 #43 #24)

78 | FIX->review | opus implementer: default merged, entry/header/footer back to design copy, buyer-only hero + locked-gift description hidden + per-course footer version; retargeted; title changed to match diff | 7d02779 | local 83/0, fail-before 2 | https://github.com/kouiso/course-library/pull/78#issuecomment-6890449785 | design 12/12 identical (evidence/design-78-7d02779/)
follow-up (8) for the manager (JUDGE, after stack 2): buyer-only library still shows survey wording outside #78 scope: header 「アンケート回答者限定」 (design), section label 「回答者限定プレゼント / SURVEY GIFT」, locked gift meta 「回答後のご案内と配布版を確認しています」, library footer gift version 0.2.2-synthetic

78 | LAND | fresh opus review PASS (must 0 want 0 nit 2) | 7d02779 | local 83/0 | https://github.com/kouiso/course-library/pull/78#issuecomment-6890490302 | merged 0939f72 (#42 #43 #24 stay open)
79 | review | default merged (no conflict), body rewritten (stale stack note, before/after product page), retargeted | d16ee63 | local 84/0 | design: only Course 1440 download rows differ (#58 align-items:center) | reviewer running
80 | FINISH | #79 head merged (import unions; test hardcoded v0.1.0 -> productVersion since product is 0.2.1) | 0801779 | local 84/0 | design 12/12 identical to #79; product page shows save-name guidance | #57 decision cited: issuecomment-6877992536, Closes #57 stands
DECIDED | #57 counts as decided (two answers recorded on the issue under the owner account, 2026-11-14 13:29Z) | reason: 5.2b source citation | revert: change #80 to Refs #57 and reopen #57

79 | LAND | fresh opus review PASS (must 0 want 2 nit 1); wants: body wording fixed, design want decided (below) | d16ee63 | local 84/0 | https://github.com/kouiso/course-library/pull/79#issuecomment-6890590063 | merged 1685dd2 (closes #56 #58)
DECIDED | #79 keeps .download align-items:center although the Course 1440 board has none | reason: measured board vs app offset is 1px either way (reviewer table), #58 asks for centring explicitly | revert: drop align-items:center from .download
DECIDED | reopened #42 #43 (closed 06:41Z as completed with no reason; completion criteria unmet because entry/header/footer keep the design copy) | reason: rules W7 close only with a written reason | revert: close again with a reason once the owner ASK is answered
closed with reason: #44 (met by #78), #22 (release:ready exit 0 on 1685dd2, gift blocked / product released), #27 (#74), #28 (#76 + #51 decision), #30 (test:browser passes end to end without env vars on 1685dd2)
issue sort 07:10Z: OWNER #42 #43 (design copy vs issue) #46 #47 (#25) #55 (#24) #35 #21 (scope decision) | agent: #23 (index.ts:169 reads env as Record again since #72 -> follow-up 2 Secrets type), #32 closes after #80 | parents waiting on children: #24 #25 #21

80 | LAND | fresh opus review PASS (must 0 want 1 nit 3); want: rename sentence source -> body cites commit 6c705a2 record (unzip failed with the versioned name) | 0801779 | local 84/0 | https://github.com/kouiso/course-library/pull/80#issuecomment-6890678663 | merged e98f770 (closes #57); #32 closed with reason
DECIDED | #80 keeps the "rename to redmine-clone.zip" sentence | reason: commit 6c705a2 records the observed unzip failure with the versioned name; #57 (2) points to Day 3; (1) still holds at save time | revert: remove the sentence from productLibrary()
follow-ups (from #79/#80 reviews): (9) product guidance copy is hardcoded for redmine-clone -> move to manifest when a 2nd ZIP product exists | (10) release-meta still grey (nit)
MEMBER 2026-11-15T07:20Z opus implementer: design conformance PR over the 12 boards (branch fix/design-conformance); not-in-design elements kept and listed

READ 2026-11-15T07:25Z origin/handoff/ritmo-hearing-20261115 (c230c41, doc/handoff/ritmo-hearing-20261115.md): record of the other account's lane; no work this lane lacks (its next steps 1-5 are landed or in work here); no wip/*-ritmo-20261115 branch exists. Rule: never push/rebase/merge/close those branches.

86 | review | opus implementer: design conformance over 12 boards (body line-height normal + board values, content-box sizes, board copy 第1章 / 問題 NN, PC/mobile copy split); kept not-in-design items listed in body | b06e5fb | local 85/0, test:browser pass | evidence/design-dc-b06e5fb/ | reviewer running
DECIDED | #86: login card spacing follows each board as drawn (Main 4px, LoginStates 0px; card moves 16px on PC when sending) | reason: owner rule = match the design exactly; the boards disagree with each other | revert: pick one value in views.ts
DECIDED | #86: synthetic labels 「開発プレビュー」「ダミー教材を見る」「ダミー教材をまとめて保存」 stay | reason: board copy would present dummy material as the real gift (pass line b/g); released state uses board copy (test) | revert: none needed once real materials ship
DECIDED | #86: product card badge 「公開中」 stays | reason: no board shows a product card | revert: use 受け取れます in productCard
next after #86: #23 fix (src/index.ts:169 `env as unknown as Record` -> typed lookup via Secrets incl. gift level names ACCESS_PHRASE_SHA256_TYPESCRIPT_01..10)

86 | LAND | fresh opus review PASS (must 0 want 1 nit 1); want recorded in body (mobile footer bookmark sentence also hidden on /guide and product page) | b06e5fb | local 85/0, test:browser pass | https://github.com/kouiso/course-library/pull/86#issuecomment-6890935675 | merged b0fb40f
follow-ups from #86: (11) mobile footer bookmark sentence: scope the hiding to the board screen only (Course) -> /guide and product page show it again (lane default; no board for those) | (12) 720-721px media gap -> use range syntax | (13) locked/pending breadcrumb aligned to page edge, not card
HOUR 2026-11-15T07:42Z | merged 7 since last HOUR (#78 #79 #80 #86 + issues) | closed 6 issues with reason (#44 #22 #27 #28 #30 #32) + reopened 2 (#42 #43) | fixed 2 (#79 test v0.1.0, #80 merge) | blocked: none | rule 2 (iteration): no board file | rule 3: n/a, no unlabeled agent issue left besides #23 | skipped (-ux): 0
MEMBER 2026-11-15T07:42Z opus implementer: #23 typed secrets (branch fix/23-typed-secrets)

87 | LAND | opus implementer + fresh opus review PASS (must 0 want 0 nit 1) | b0b4b7c | local 86/0 | https://github.com/kouiso/course-library/pull/87#issuecomment-6891054514 | merged 74016e6 (closes #23)
DECIDED | #87 gift level setting names spell TYPESCRIPT, guarded by a startup check against the gift id | reason: one gift only; drift closes the site at startup; reviewer judged sound | revert: build giftLevelEnvNames from the gift id
MEMBER 2026-11-15T07:32Z opus implementer: #86 follow-ups (11)(12)(13) in one PR (branch fix/86-followups)
remaining lane follow-ups after this PR: (1) duplicate hash = broken config, (3) 61 s test, (4) grammar "the survey gift stay", (5) manifest.ts delivery sentence claims a check the repo lacks, (6) check-release reads policies directly / shared approval object / approval ?. === true, (7) bundle box below level 10, SETUP lacks _01.._10 settings, validateManifest checks untested, (9) per-product guidance copy, (10) release-meta grey

88 | LAND | opus implementer + fresh opus review PASS (must 0 want 0 nit 1); CodeRabbit no actionable comments | ac41f84 | local 89/0, test:browser pass | https://github.com/kouiso/course-library/pull/88#issuecomment-6891211817 | merged fa9f35a (follow-ups 11 12 13 done)
MEMBER 2026-11-15T07:48Z opus implementer: release check correctness (follow-ups 1 4 5 6, validateManifest tests from 7) branch fix/release-check-correctness
remaining after it: (3) 61 s test, (7) bundle box below level 10 + SETUP _01.._10 settings, (9) per-product guidance copy (only when a 2nd ZIP product exists), (10) release-meta grey (nit)

89 | LAND | opus implementer + fresh opus review PASS (must 0 want 0 nit 1) | 1e30f67 | local 96/0, release:ready exit 0 | https://github.com/kouiso/course-library/pull/89#issuecomment-6891329149 | merged 7691648 (follow-ups 1 4 5 6 done)
DECIDED | #89 product delivery sentence reworded to what the repo tests | reason: the old sentence claimed a check this repo lacks; true copy is the safe side | revert: restore the old sentence with a pointer to where that check is recorded
DECIDED | product phrase set equal to the gift digest: that phrase opens only the gift, the product stays closed as 配布設定の確認中, no extra login message | reason: fails closed; operator misconfiguration only | revert: add a note at login when a product is under configuration check
follow-up (3) 61 s test: DONE-ALREADY — full suite 10.6 s on 7691648, longest test 1.5 s (the 61 s was the test:browser timeout fixed by #30)
MEMBER 2026-11-15T08:02Z opus implementer: follow-up (7) gift level: empty bundle box below level 10 + SETUP _01.._10 (branch fix/72-gift-level-followups)
not startable: (9) per-product guidance copy -> only when a 2nd ZIP product exists | (10) release-meta grey: nit, no board for the product page -> no action

DECIDED | below gift level 10 the learning page drops only the bundle parts of 「まとめて手元に」 and keeps the release verification sentences in the card (option B) | reason: hiding the whole box would remove the only place those true environment notes show for PDF-only sessions; no new copy | revert: hide the whole card below level 10
follow-ups (14) /library gift card shows 「本編 10章 / 練習問題 9本 / まとめて保存」 below level 10 | (15) ACCESS_PHRASE_SHA256_REDMINE_CLONE missing from SETUP tables

90 | LAND | opus implementer (decision B) + fresh opus review PASS (must 0 want 1 nit 1); want = body line (want 3 already in #89) fixed | 15811e2 | local 97/0, test:browser pass | https://github.com/kouiso/course-library/pull/90#issuecomment-6891435372 | merged 82e0758 (follow-up 7 done)
MEMBER 2026-11-15T08:10Z opus implementer: follow-up (14) + 「本編 0章」: level-aware counts on /library card and learning page (branch fix/gift-level-counts)
remaining after it: (15) ACCESS_PHRASE_SHA256_REDMINE_CLONE missing from SETUP tables (docs) | nits: SETUP rules "malformed matches nobody" / "highest level wins" untested; level-aware breadcrumb/test:browser position checks

91 | LAND | opus implementer + fresh opus review PASS (must 0 want 0 nit 2, PR text only) | e8870c0 | local 98/0, test:browser pass | https://github.com/kouiso/course-library/pull/91#issuecomment-6891543195 | merged 9e085a8 (follow-up 14 + 「本編 0章」 done)
DECIDED | sessions with no gift level (pre-level cookies, expire within 4 h) get no new copy | reason: transient; new copy is a product call with no source | revert: add a sentence on the learning page
MEMBER 2026-11-15T08:18Z opus implementer: follow-up (15) docs SETUP product phrase setting (branch docs/product-phrase-setting)
HOUR 2026-11-15T08:18Z | merged 5 since 07:42 (#87 #88 #89 #90 #91) | closed 1 issue (#23 via #87) | fixed 0 | blocked: none | skipped (-ux): 0 | remaining nits (no action): SETUP rules untested (malformed matches nobody / highest level wins), browser-position checks, release-meta grey

MODEL 2026-11-15T08:16Z | lead switched to fable; subagents spawned from now use model fable (one alive at a time unchanged). The docs implementer already running was started on opus before the order and is left to finish.

92 | FIX->review | opus implementer (docs SETUP product phrase); fresh fable review FAIL at b32482f (must 2: unset row claimed the product never opens although earlier sessions stay open 4 h; duplicate sentence false for product-vs-product) | fixed by lead in 75121ad (docs wording only) | local 98/0 | https://github.com/kouiso/course-library/pull/92#issuecomment-6891638276 | second fresh fable reviewer running (one fix round rule: a second FAIL parks it)
DECIDED | product phrase not added to the first-deploy secret list in SETUP | reason: that list is the owner's distribution procedure (#35 / #21) | revert: add the row when #35 is decided

92 | LAND | fix round by lead (75121ad) + second fresh fable review PASS (must 0 want 1 = stale PR body, fixed) | 75121ad | local 98/0 | https://github.com/kouiso/course-library/pull/92#issuecomment-6891706086 | merged 4118b5a (follow-up 15 done)
CYCLE 2 T=2026-11-15T08:36Z | PRs 2 (#84 #85, never merge) | issues 9 (#21 #24 #25 #35 #42 #43 #46 #47 #55) | ledger rows 0
CORRECTION 2026-11-15T08:40Z | #35 was parked as OWNER by the previous lane and carried over by this lane. It is not: its two dependencies are closed and the owner answered all four points on #34 on 2026-11-14 (https://github.com/kouiso/course-library/issues/34#issuecomment-6877495479). #35 moved to agent work; #21 (parent) closes after it. Cause: the sort trusted the handoff line instead of reading the dependency issue. Check added: before parking an item as OWNER, read the comments of every issue it names as its decision.
MEMBER 2026-11-15T08:40Z fable implementer: #35 docs to the decided scope + product distribution procedure in OPERATIONS (branch docs/35-decided-scope)

93 | review | fable implementer: #35 docs to the decided scope (#34 answers), OPERATIONS section "Distribute a paid product", manifest comments, test/browser-check wording; Closes #35 | 472b7bc | local 98/0, test:browser pass | evidence/35-472b7bc.png | fresh fable reviewer running; CodeRabbit reviewing

## needs owner
- ASK #42 #43 | Entry screen, header and footer: should the issue wording (no survey wording for buyers) win over the design board copy (「A GIFT FOR SURVEY RESPONDENTS」「アンケート回答者限定」「回答後に届いたご案内のURL…」)? yes/no/don't know | read: issues #42 #43, design Main/EntryMobile/Library boards, PR #78 #86 | they contradict each other | on "don't know": design copy stays (current state)
- #47 | Show products the visitor does not own in the library? (A) hide (B) show with a link to the sales page (needs the URL) | default: current (shown, no link)
- #46 | depends on #47; restyle locked cards and put open ones first | waits for #47
- #55 | /status: (A) remove (B) keep but not for non-gift sessions | default: unchanged
- #24 #25 | parent stories; close when #42 #43 #55 / #46 #47 are settled (re-checked 08:40Z: #55 #47 carry no decision comment; #46 waits on #47)
- (8) buyer-only library still shows the survey section label, locked gift meta line, gift footer version — same question as #42 #43
- #27 option: extend the 600 s entry token? default: no
- ASK (from #92 review) | Removing the product phrase setting leaves product sessions opened earlier able to download until their 4-hour expiry, while a malformed value closes them at once. Should an unset setting also close existing product sessions? yes/no/don't know | read: src/index.ts misconfiguredProducts (skips empty values), PR #92 review | the code is consistent either way; it is a distribution-stop policy | on "don't know": unchanged (documented in SETUP by #92)
- ASK (from #93) | Decision (2) on #34 says Taskapp is listed as a paid product. Is Taskapp the same product as the manifest's `redmine-clone`? yes/no/don't know | read: issue #34 comment 6877495479, git log of the commits that added the product, README, docs, src/manifest.ts | none of them links the two names | on "don't know": docs speak of "paid products for buyers (currently redmine-clone)" and do not mention Taskapp (state after #93); if "no", adding Taskapp needs its own manifest entry and materials (owner-only)
- owner-only facts (from #93) | two statements about the real production state were left untouched because the repository cannot show what is deployed: docs/SECURITY.md last line ("No real material ... or deployment has been performed by the prototype") and README ("Production Cloudflare is verified for the synthetic build only"). Are they still true? yes/no | default: unchanged
- any approval flag change, any deploy: owner only

## for main session
- first message carried no plan rows (LEDGER); lane works open PRs and issues from the handoff.
