# Design vs. app — e8870c0

- app: `e8870c0` (/home/user/wlc), synthetic local runtime on http://127.0.0.1:40761
- design: Course Library 画面デザイン (12 boards)
- captured: 2026-11-15T08:08:59Z (UTC), Chromium 153.0.8010.12, deviceScaleFactor 1, viewport = board w × board h, full page
- method: visible text nodes in document order, LCS-aligned; styles compared only for matched text (background = nearest non-transparent ancestor).
- the LoginStates "sending" state is reproduced by letting the app's own submit handler run and cancelling navigation; the real request is not held.
- local-only: the yellow synthetic notice and the "ダミー教材を見る" label are gated on the release being synthetic / local mode; the version, badge, material titles and verification text come from src/manifest.ts on this commit and are real.
- form controls carry no text nodes; their size differences show only in the images and via line-height of the button label.

## Main — 入口（PC 1440）

- app: GET / (anonymous)
- page height: board 1000px, design rendered 1000px, app entry 1000px
- text nodes: design 17, app 17, matched 16

### Text (design order)

- design only: `教材ライブラリ · 0.2.x` (footer)
- app only: `教材ライブラリ · 0.2.2-synthetic` (footer)

### Style of matched text (design → app)

- none

## EntryMobile — 入口（スマホ 390）

- app: GET / (anonymous)
- page height: board 844px, design rendered 844px, app entry 844px
- text nodes: design 13, app 13, matched 12

### Text (design order)

- design only: `教材ライブラリ · 0.2.x` (footer)
- app only: `教材ライブラリ · 0.2.2-synthetic` (footer)

### Style of matched text (design → app)

- none

## LoginStates — 合言葉の入力：誤入力・送信中（PC）

- app: POST /login wrong phrase (401) + sending state (submit held client-side)
- page height: board 760px, design rendered 760px, app wrong 830px, sending 830px
- text nodes: design 10, app 10, matched 10 (app scoped to `.login-card`, design to `section`)

### Text (design order)

- none

### Style of matched text (design → app)

- none

## LoginStatesMobile — 合言葉の入力：誤入力・送信中（スマホ）

- app: POST /login wrong phrase (401) + sending state (submit held client-side)
- page height: board 1180px, design rendered 1180px, app wrong 1180px, sending 1180px
- text nodes: design 10, app 10, matched 10 (app scoped to `.login-card`, design to `section`)

### Text (design order)

- none

### Style of matched text (design → app)

- none

## Library — 教材の一覧（PC）

- app: GET /library (gift phrase)
- page height: board 1100px, design rendered 1100px, app library 1604px
- text nodes: design 26, app 41, matched 23

### Text (design order)

- design only: `受け取れます` (span)
- app only: `開発プレビュー` (span)
- design only: `教材を受け取る` (a)
- app only: `ダミー教材を見る` (a)
- design only: `教材ライブラリ · 0.2.x` (footer)
- app only: `0.2.2-synthetic` (small)
- app only: `教材（販売）` (h2)
- app only: `PAID PRODUCT` (span)
- app only: `PAID PRODUCT` (span)
- app only: `Build a` (strong)
- app only: `Redmine clone.` (strong)
- app only: `RM` (div)
- app only: `商品用の合言葉が必要` (span)
- app only: `Redmineクローン教材` (h2)
- app only: `30日で学ぶフルスタック開発教材のソースコードです。` (p)
- app only: `ご購入時にお渡しする商品用の合言葉で開きます` (div)
- app only: `商品用の合言葉が必要です` (a)
- app only: `↗` (span)
- app only: `ライブラリを閉じる` (button)
- app only: `アクセスの有効期限は4時間です。` (p)
- app only: `教材ライブラリ · 0.2.2-synthetic` (footer)

### Style of matched text (design → app)

- none

## LibraryMobile — 教材の一覧（スマホ）

- app: GET /library (gift phrase)
- page height: board 1300px, design rendered 1300px, app library 1855px
- text nodes: design 24, app 39, matched 21

### Text (design order)

- design only: `受け取れます` (span)
- app only: `開発プレビュー` (span)
- design only: `教材を受け取る` (a)
- app only: `ダミー教材を見る` (a)
- design only: `教材ライブラリ · 0.2.x` (footer)
- app only: `0.2.2-synthetic` (small)
- app only: `教材（販売）` (h2)
- app only: `PAID PRODUCT` (span)
- app only: `PAID PRODUCT` (span)
- app only: `Build a` (strong)
- app only: `Redmine clone.` (strong)
- app only: `RM` (div)
- app only: `商品用の合言葉が必要` (span)
- app only: `Redmineクローン教材` (h2)
- app only: `30日で学ぶフルスタック開発教材のソースコードです。` (p)
- app only: `ご購入時にお渡しする商品用の合言葉で開きます` (div)
- app only: `商品用の合言葉が必要です` (a)
- app only: `↗` (span)
- app only: `ライブラリを閉じる` (button)
- app only: `アクセスの有効期限は4時間です。` (p)
- app only: `教材ライブラリ · 0.2.2-synthetic` (footer)

### Style of matched text (design → app)

- none

## Course — 学習案内（PC）

- app: GET /courses/typescript (gift phrase)
- page height: board 1640px, design rendered 1905px, app course 2028px
- text nodes: design 66, app 68, matched 64

### Text (design order)

- app only: `ローカル確認用のダミー教材です。実教材と配布設定の確認が終わるまで本番配布は行いません。` (p)
- design only: `教材をまとめて保存` (a)
- app only: `ダミー教材をまとめて保存` (span)
- app only: `MacのローカルWorkerとChromiumで配布機能を検証しています。 この画面の教材はダミーです。実教材と配布版は未検証です。 Wi…` (p)
- design only: `教材ライブラリ · 0.2.x` (footer)
- app only: `教材ライブラリ · 0.2.2-synthetic` (footer)

### Style of matched text (design → app)

- none

## CourseMobile — 学習案内（スマホ）

- app: GET /courses/typescript (gift phrase)
- page height: board 2300px, design rendered 2300px, app course 2300px
- text nodes: design 62, app 64, matched 60

### Text (design order)

- app only: `ローカル確認用のダミー教材です。実教材と配布設定の確認が終わるまで本番配布は行いません。` (p)
- design only: `教材をまとめて保存` (a)
- app only: `ダミー教材をまとめて保存` (span)
- app only: `MacのローカルWorkerとChromiumで配布機能を検証しています。 この画面の教材はダミーです。実教材と配布版は未検証です。 Wi…` (p)
- design only: `教材ライブラリ · 0.2.x` (footer)
- app only: `教材ライブラリ · 0.2.2-synthetic` (footer)

### Style of matched text (design → app)

- none

## Preparing — 準備中 503（PC）

- app: GET /download/typescript/exercise-10 with an empty R2 object (503)
- page height: board 820px, design rendered 820px, app preparing 820px
- text nodes: design 8, app 8, matched 7

### Text (design order)

- design only: `教材ライブラリ · 0.2.x` (footer)
- app only: `教材ライブラリ · 0.2.2-synthetic` (footer)

### Style of matched text (design → app)

- none

## PreparingMobile — 準備中 503（スマホ）

- app: GET /download/typescript/exercise-10 with an empty R2 object (503)
- page height: board 844px, design rendered 844px, app preparing 844px
- text nodes: design 8, app 8, matched 7

### Text (design order)

- design only: `教材ライブラリ · 0.2.x` (footer)
- app only: `教材ライブラリ · 0.2.2-synthetic` (footer)

### Style of matched text (design → app)

- none

## Logout — ログアウト後（PC）

- app: POST /logout -> /closed
- page height: board 820px, design rendered 820px, app logout 820px
- text nodes: design 7, app 7, matched 6

### Text (design order)

- design only: `教材ライブラリ · 0.2.x` (footer)
- app only: `教材ライブラリ · 0.2.2-synthetic` (footer)

### Style of matched text (design → app)

- none

## LogoutMobile — ログアウト後（スマホ）

- app: POST /logout -> /closed
- page height: board 844px, design rendered 844px, app logout 844px
- text nodes: design 7, app 7, matched 6

### Text (design order)

- design only: `教材ライブラリ · 0.2.x` (footer)
- app only: `教材ライブラリ · 0.2.2-synthetic` (footer)

### Style of matched text (design → app)

- none
