# Design vs. app — 28c4c27

- app: `28c4c27` (/workspace/wcmp), synthetic local runtime on http://127.0.0.1:37481
- design: Course Library 画面デザイン (12 boards)
- captured: 2026-11-15T01:29:33Z (UTC), Chromium 153.0.8010.12, deviceScaleFactor 1, viewport = board w × board h, full page
- method: visible text nodes in document order, LCS-aligned; styles compared only for matched text (background = nearest non-transparent ancestor).
- the LoginStates "sending" state is reproduced by letting the app's own submit handler run and cancelling navigation; the real request is not held.
- local fixture effects (synthetic notice, "ダミー教材を見る", version `0.2.2-synthetic`/manifest version vs. board `0.2.x`) are expected local differences, not design gaps.

## Main — 入口（PC 1440）

- app: GET / (anonymous)
- page height: board 1000px, design rendered 1000px, app entry 1000px
- text nodes: design 17, app 17, matched 16

### Text (design order)

- design only: `教材ライブラリ · 0.2.x` (footer)
- app only: `教材ライブラリ · 0.2.2-synthetic` (footer)

### Style of matched text (design → app)

- `REPEAT.` font-weight: 800 → 900

## EntryMobile — 入口（スマホ 390）

- app: GET / (anonymous)
- page height: board 844px, design rendered 844px, app entry 844px
- text nodes: design 13, app 14, matched 11

### Text (design order)

- design only: `アンケートへのご協力、ありがとうございます。回答後のご案内に記載された合言葉を入力してください。` (p)
- app only: `アンケートへのご協力、ありがとうございます。` (p)
- app only: `回答後のご案内に記載された合言葉を入力してください。` (p)
- design only: `教材ライブラリ · 0.2.x` (footer)
- app only: `教材ライブラリ · 0.2.2-synthetic` (footer)

### Style of matched text (design → app)

- none

## LoginStates — 合言葉の入力：誤入力・送信中（PC）

- app: POST /login wrong phrase (401) + sending state (submit held client-side)
- page height: board 760px, design rendered 760px, app wrong 844px, sending 844px
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
- page height: board 1100px, design rendered 1100px, app library 1651px
- text nodes: design 26, app 42, matched 22

### Text (design order)

- design only: `受け取れます` (span)
- app only: `開発プレビュー` (span)
- design only: `学習の進め方 / 本編 10章 / 練習問題 9本 / まとめて保存` (div)
- design only: `教材を受け取る` (a)
- app only: `学習の進め方 / 本編 10章 / 練習問題 9本` (div)
- app only: `/ まとめて保存` (span)
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

- `REPEAT.` font-weight: 800 → 900

## LibraryMobile — 教材の一覧（スマホ）

- app: GET /library (gift phrase)
- page height: board 1300px, design rendered 1300px, app library 1866px
- text nodes: design 24, app 40, matched 20

### Text (design order)

- design only: `アンケートにお答えいただいた方へ。TypeScript教材を無料プレゼントとしてお届けします。` (p)
- app only: `アンケートにお答えいただいた方へ。` (p)
- app only: `TypeScript教材を無料プレゼントとしてお届けします。` (p)
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

- `REPEAT.` font-weight: 800 → 900

## Course — 学習案内（PC）

- app: GET /courses/typescript (gift phrase)
- page height: board 1640px, design rendered 1905px, app course 2221px
- text nodes: design 66, app 69, matched 54

### Text (design order)

- app only: `ローカル確認用のダミー教材です。実教材と配布設定の確認が終わるまで本番配布は行いません。` (p)
- design only: `第1章` (a)
- app only: `第01章` (span)
- design only: `第2章` (a)
- app only: `第02章` (span)
- design only: `第3章` (a)
- app only: `第03章` (span)
- design only: `第4章` (a)
- app only: `第04章` (span)
- design only: `第5章` (a)
- app only: `第05章` (span)
- design only: `第6章` (a)
- app only: `第06章` (span)
- design only: `第7章` (a)
- app only: `第07章` (span)
- design only: `第8章` (a)
- app only: `第08章` (span)
- design only: `第9章` (a)
- app only: `第09章` (span)
- design only: `学んだ内容を手を動かして確かめましょう。第9章には練習問題がありません。` (p)
- app only: `学んだ内容を手を動かして確かめましょう。` (span)
- app only: `第9章には練習問題がありません。` (p)
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
- text nodes: design 62, app 66, matched 41

### Text (design order)

- design only: `学習の進め方を確認したら、本編と練習問題へ。手元に保存して、ひとつずつ進めましょう。` (p)
- app only: `学習の進め方を確認したら、本編と練習問題へ。` (p)
- app only: `手元に保存して、ひとつずつ進めましょう。` (p)
- app only: `ローカル確認用のダミー教材です。実教材と配布設定の確認が終わるまで本番配布は行いません。` (p)
- design only: `第1章` (a)
- app only: `第01章` (span)
- design only: `第2章` (a)
- app only: `第02章` (span)
- design only: `第3章` (a)
- app only: `第03章` (span)
- design only: `第4章` (a)
- app only: `第04章` (span)
- design only: `第5章` (a)
- app only: `第05章` (span)
- design only: `第6章` (a)
- app only: `第06章` (span)
- design only: `第7章` (a)
- app only: `第07章` (span)
- design only: `第8章` (a)
- app only: `第08章` (span)
- design only: `第9章` (a)
- app only: `第09章` (span)
- design only: `問題 01` (a)
- app only: `練習問題 01` (span)
- design only: `問題 02` (a)
- app only: `練習問題 02` (span)
- design only: `問題 03` (a)
- app only: `練習問題 03` (span)
- design only: `問題 04` (a)
- app only: `練習問題 04` (span)
- design only: `問題 05` (a)
- app only: `練習問題 05` (span)
- design only: `問題 06` (a)
- app only: `練習問題 06` (span)
- design only: `問題 07` (a)
- app only: `練習問題 07` (span)
- design only: `問題 08` (a)
- app only: `練習問題 08` (span)
- design only: `問題 10` (a)
- app only: `練習問題 10` (span)
- design only: `教材をまとめて保存` (a)
- app only: `ダミー教材をまとめて保存` (span)
- app only: `MacのローカルWorkerとChromiumで配布機能を検証しています。 この画面の教材はダミーです。実教材と配布版は未検証です。 Wi…` (p)
- design only: `教材ライブラリ · 0.2.x` (footer)
- app only: `教材ライブラリ · 0.2.2-synthetic` (footer)
- app only: `ご案内のURLをブックマークしてご利用ください。` (span)

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
