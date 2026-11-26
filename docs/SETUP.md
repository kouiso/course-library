# 初回公開の準備

この文書は準備用です。認証情報の作成や設定、リソース作成、公開を実行するものではありません。

## 決めることは3つ

1. **配布対象**：配る物は2種類です。アンケート回答者向けの無料プレゼント（TypeScript教材）と、買った人向けの商品（今は`redmine-clone`と`task-app`）です。商品は無料プレゼントに入れません。プレゼントの合言葉で商品は開かず、商品の合言葉でプレゼントは開きません。プレゼントについては、TypeScriptの実配布版とMyASPの回答者向け案内設定を確認します。商品を配る手順は[OPERATIONS.mdの「Distribute a paid product」](OPERATIONS.md#distribute-a-paid-product)にあります。
2. **公開先**：既存の本人アカウントに新しいWorkerと私有R2を作ります。既存の別サービス用リソースは使いません。最初は既存の`workers.dev`サブドメインを使うとDNS設定を減らせます。
3. **秘密情報の安全な保管先**：利用者が管理する既存の秘密管理先を指定します。値をチャット、公開Git、コマンド引数、ログに貼らない方法を使います。

契約プランと利用上限は、金額を表示せずに別途確認します。APIの`type: standard`や`default_usage_model: standard`は契約プランの証明にはなりません。確認できない場合に、購入やプラン変更を進めることはありません。

## 用意する秘密情報

| 種類 | 用途 | 最終的な保存先 |
| --- | --- | --- |
| アクセス用の合言葉（ギフト） | 無料プレゼントを開く。十分にランダムな128ビット以上の値を使う | 元の値は利用者の秘密管理先。SHA-256ダイジェストだけをWorkerの`ACCESS_PHRASE_SHA256`へ |
| 商品の合言葉 | 買った人が商品を開く。商品ごとに別の、十分にランダムな128ビット以上の値を使う | 元の値は利用者の秘密管理先。SHA-256ダイジェストだけをWorkerの商品用のSecret（`redmine-clone`なら`ACCESS_PHRASE_SHA256_REDMINE_CLONE`。名前の決まりは[商品の合言葉（任意）](#商品の合言葉任意)）へ |
| セッション署名鍵 | 有効期限付きCookieを署名する。32ランダムバイト以上 | Workerの`SESSION_SECRET`と利用者の秘密管理先 |
| 外側のBasic認証のIDとパスワード | 本番でサイトの全ページの前に入力する。配り始めた後も外さない | Workerの`BASIC_AUTH_USER`・`BASIC_AUTH_PASS`と利用者の秘密管理先 |
| PDFの開封パスワード | 確認済みの同一配布版のPDFを開く | 利用者の秘密管理先と、別途承認された読者向け案内。WorkerやGitHubへ保存する必要はない |
| PDFの所有者パスワード | 暗号化コピーの管理。開封用とは別のランダム値 | 利用者の秘密管理先のみ |
| Cloudflareデプロイトークン（継続CDを別途許可した場合だけ） | 検証済みコードをGitHubから自動配布する | `kouiso/course-library`の`production`環境シークレット。初回の手動公開には新規トークンを前提としない |

合言葉、PDF用パスワード、署名鍵、デプロイトークンは使い回しません。PDFの印刷やコピーは利用可能なままにします。

買った人への合言葉の渡し方は運営側で決めてあります。中身は、公開されているこのリポジトリには書きません。

## 本番に必須の設定値

Workerは起動のたびに次の条件を確かめます（`src/index.ts`の`configured`）。1つでも欠けるか形が違うと、サイト全体が「ただいま準備中です」の503になり、原因は画面にもログにも出ません。表と`configured`の条件は1対1です。

| 名前 | 種類と置き場所 | 本番の条件 |
| --- | --- | --- |
| `APP_ORIGIN` | `wrangler.jsonc`の`vars` | `https:`のオリジンだけ（末尾の`/`・パス・ID・パスワードを含めない。ホスト名が`.invalid`で終わる物は不可）。ローカルは`http://localhost`か`http://127.0.0.1` |
| `APP_MODE` | `wrangler.jsonc`の`vars` | `production`と書く（`local`以外はすべて本番扱い）。`local`はローカルの確認だけ |
| `SESSION_SECRET` | WorkerのSecret | 43文字以上（32ランダムバイト以上をbase64urlにした値） |
| `ACCESS_PHRASE_SHA256` | WorkerのSecret | 合言葉のSHA-256ダイジェスト。**小文字の16進64文字**（大文字や空白・改行が入ると不一致） |
| `BASIC_AUTH_USER` | WorkerのSecret | 本番だけ必須。外側のBasic認証のID（空でない） |
| `BASIC_AUTH_PASS` | WorkerのSecret | 本番だけ必須。外側のBasic認証のパスワード（空でない） |
| `MATERIALS` | `wrangler.jsonc`の`r2_buckets` | 教材の私有R2バケットのバインディング |
| `LOGIN_IP_LIMIT`・`LOGIN_TOTAL_LIMIT` | `wrangler.jsonc`の`ratelimits` | 合言葉の入力回数の制限のバインディング |

ダイジェストの作り方（合言葉はコマンドの引数や画面に出さず、改行なしで標準入力から渡します）:

```sh
printf %s "$PHRASE" | shasum -a 256 | cut -d' ' -f1
```

`$PHRASE`は、`read -rs PHRASE`のように画面にも履歴にも残さない方法で用意したシェル変数です。`shasum`が無い環境では`sha256sum`を使います。出力が小文字の16進64文字になっていることを確かめてから、Secretに入れます。

## ギフトの段の合言葉（任意）

ギフト（TypeScript教材）は、段つきの合言葉で途中の章まで開けられます（段と教材の対応は`src/manifest.ts`の`giftMaterialLevel`）。N段目の合言葉で、学習の進め方・第1〜N章・第N章までの練習問題が開きます。まとめZIPは10段目だけで開きます。従来の`ACCESS_PHRASE_SHA256`は10段目と同じく全部を開けます。

どれもWorkerのSecretで、値の形は`ACCESS_PHRASE_SHA256`と同じ（合言葉のSHA-256ダイジェスト、**小文字の16進64文字**）です。上の表の条件（`configured`）には入らないので、未設定や形の違う値でもサイトは503になりません。その段の合言葉が誰にも合わないだけで、原因は画面にもログにも出ません。1つの合言葉が複数の段に合った時は、一番上の段が開きます。

| 名前 | 開く教材（前の段の分を含む） |
| --- | --- |
| `ACCESS_PHRASE_SHA256_TYPESCRIPT_01` | 学習の進め方・第1章・練習問題 01 |
| `ACCESS_PHRASE_SHA256_TYPESCRIPT_02` | 学習の進め方・第1〜2章・練習問題 01〜02 |
| `ACCESS_PHRASE_SHA256_TYPESCRIPT_03` | 学習の進め方・第1〜3章・練習問題 01〜03 |
| `ACCESS_PHRASE_SHA256_TYPESCRIPT_04` | 学習の進め方・第1〜4章・練習問題 01〜04 |
| `ACCESS_PHRASE_SHA256_TYPESCRIPT_05` | 学習の進め方・第1〜5章・練習問題 01〜05 |
| `ACCESS_PHRASE_SHA256_TYPESCRIPT_06` | 学習の進め方・第1〜6章・練習問題 01〜06 |
| `ACCESS_PHRASE_SHA256_TYPESCRIPT_07` | 学習の進め方・第1〜7章・練習問題 01〜07 |
| `ACCESS_PHRASE_SHA256_TYPESCRIPT_08` | 学習の進め方・第1〜8章・練習問題 01〜08 |
| `ACCESS_PHRASE_SHA256_TYPESCRIPT_09` | 学習の進め方・第1〜9章・練習問題 01〜08（第9章の練習問題は無い） |
| `ACCESS_PHRASE_SHA256_TYPESCRIPT_10` | ギフト全部（学習の進め方・第1〜10章・練習問題 01〜08と10・まとめZIP） |

## 商品の合言葉（任意）

商品は、ギフトとは別の合言葉で開きます。設定名は商品ごとに決まり、`redmine-clone`なら`ACCESS_PHRASE_SHA256_REDMINE_CLONE`、`task-app`なら`ACCESS_PHRASE_SHA256_TASK_APP`で、WorkerのSecretです。値の形は`ACCESS_PHRASE_SHA256`と同じ（合言葉のSHA-256ダイジェスト、**小文字の16進64文字**）で、上の[ダイジェストの作り方](#本番に必須の設定値)で作ります。「本番に必須の設定値」の表の条件（`configured`）には入らないので、未設定でも形が違ってもサイト全体は503になりません。どの設定がどう違うかは、画面にもログにも出ません（形が違う時と重なった時に、配布設定を確認している事だけが画面に出ます）。

| 設定の状態 | Workerの動き |
| --- | --- |
| 未設定（空の値を含む） | 商品の合言葉は誰にも合わず、新しく商品を開ける人はいません。サイトとギフトは動きます。入口で合言葉が合わない時は、ほかに閉じた商品が無ければ、打ち間違いの時と同じ401の表示です。設定を外す前に商品を開けた人のセッションは閉じません。期限（4時間）が切れるまで、商品ページも`/download/redmine-clone/…`も今までどおり開きます |
| 形が違う（大文字・ダイジェストにしていない合言葉・長さ違い等） | 商品だけを閉じます。入口では商品の合言葉を照合せず、合う合言葉が無い時の表示に「販売中の教材は、ただいま配布設定を確認しています。」を添えます。商品を開けたセッションでは、`/courses/redmine-clone`も`/download/redmine-clone/…`も「配布設定の確認中です」の503になり、設定を間違える前に入った人にも教材を渡しません。サイトとギフトは動きます |
| ほかのコレクションの合言葉と同じダイジェスト | 形が違う時と同じく、商品だけを閉じます |

商品の合言葉のダイジェストは、ほかのコレクションの合言葉（ギフトの`ACCESS_PHRASE_SHA256`・ギフトの段の合言葉・ほかの商品の合言葉）と別の値にします。同じ値だと1つの合言葉で2つのコレクションが開くので、Workerはその商品を閉じます。相手がギフト（`ACCESS_PHRASE_SHA256`か段の合言葉）の時は、その合言葉でギフトだけが開きます。相手がほかの商品の時は、両方の商品を閉じます。ギフトの中での重なり（段の合言葉と`ACCESS_PHRASE_SHA256`が同じ等）は、同じギフトが開くだけなので閉じません。

商品を足す時の設定名は、`ACCESS_PHRASE_SHA256_`の後ろに、商品の`id`を大文字にして`-`を`_`に変えた物を付けます（`src/manifest.ts`の`productPhraseEnvName`。`redmine-clone`なら`ACCESS_PHRASE_SHA256_REDMINE_CLONE`）。同じ名前を`src/manifest.ts`の`Secrets`に足し、マニフェストのその商品の`phraseEnv`に書きます。`phraseEnv`に`Secrets`に無い名前やギフトの段の合言葉の名前を書くと、`npm run typecheck`が失敗します。`phraseEnv`が無い時、`id`から作った名前と違う時、ギフトの合言葉や段の合言葉と同じ名前の時は、`validateManifest`が止めるので、サイト全体が「ただいま準備中です」の503になります。

## 初回は既存接続で手動公開する

既存のCloudflare接続は、Workerのアップロード・版作成・デプロイ、R2バケット作成・オブジェクトアップロードに対応するAPIを呼べます。APIの対応と実アカウントでの書き込み許可は別なので、変更による権限テストは行いません。初回公開のために新規の継続用APIトークンを先に作る必要はありません。

1. 対象アカウント・新Worker・新しい私有R2を指定する。新しい権限や課金を発生させずに実行できること、契約と利用上限を先に確認する。既存接続で拒否された操作は、勝手に権限を増やさず報告する。
2. アプリ用の秘密値の保存先を、対象WorkerのSecret型バインディング`ACCESS_PHRASE_SHA256`・`SESSION_SECRET`・`BASIC_AUTH_USER`・`BASIC_AUTH_PASS`として確定する（[本番に必須の設定値](#本番に必須の設定値)の表のSecret全部）。商品を配る時は、その商品の合言葉のSecret（[商品の合言葉（任意）](#商品の合言葉任意)）も同じ方法で置く。置かない間は、商品を新しく開ける人はいない。合言葉の元の値や保管用コピーは、利用者が指定した既存の秘密管理先で扱う。
3. 秘密値の入力は、所有者がCloudflareの対象Workerの **Settings → Variables and Secrets → Add → Secret** へ直接入力する方法が公式に対応している。AIは変数名と対象を準備し、値はチャットで尋ねない。最後のDeployは配信開始を伴うため、その前に必要な確認を終える。
4. ローカルの既存認証が別途確認できる場合は、非表示の対話入力や所有者だけが読める秘密ファイルによるWrangler入力も候補になる。既存コネクターにはローカル秘密ファイルを非表示のまま渡す入力欄が確認できていないため、その経路の全自動化は約束しない。実教材のローカルファイルからの大容量バイナリ転送も別途確認する。

1Password CLIの設定状態は、ブラウザーやアプリの保管庫の有無を示すものではありません。既知のパスワードをチャットへ貼ってもらったり、別タスクの認証要求を再送・流用したりしません。

通常の`wrangler secret put`は新しい版を**即時デプロイ**します。公開しない準備には使いません。既存の版に対する`wrangler versions secret put`や`wrangler versions upload --secrets-file`は版作成と配信開始を分けるための候補です。初回の対象Workerの状態とCLIの動作を確認してから選びます。

## GitHubによる継続CDは別途決める

GitHub ActionsはCodexのCloudflare接続をそのまま使えません。自動CDを選ぶ場合だけ、GitHubに渡す継続用認証を別の承認対象にします。現時点で新規の継続アクセス権は許可されていません。

`Workers Scripts Edit`／`Workers Scripts Write`は公式のAPI権限一覧では**アカウント単位**の権限です。この古い権限を付けたトークンを「Worker名1つだけに限定できる」とは扱いません。

新しいWorkers認可ドキュメントには、作成済みの個別Workerに対するEditorのAPIトークンが別の仕組みとして記載されています。ただし、このアカウントの発行画面・実際のポリシーで対象Workerだけに限定できることは未確認です。利用可能と断言せず、具体的な範囲を読み取り確認できてから提案します。利用できない場合にアカウント全体の権限へ置き換えることはありません。

新規Worker作成と作成済みWorkerへの継続デプロイは権限が異なります。将来の継続用資格情報には、新規作成用のAdmin、他Worker、R2オブジェクト操作、DNS、Billing、メンバー管理の権限を含めないことを目標にします。R2のランタイムアクセスはWorkerバインディングで行います。

## 配布版と回答者向け導線を確認してから公開する

上の準備では、アプリ配信、実教材の暗号化・アップロード、Actions実行、読者への連絡をしません。TypeScriptの実配布版、MyASPのアンケート回答者向け導線、安全な配布コピー、実契約・上限、同一コミットの検証が揃ってから、公開範囲と配信開始を承認します。

PDF暗号化ツールは現在の公式版を使い、秘密値を引数に置かない方法を選びます。qpdfのJob JSON入力は候補ですが、実行環境の導入・確認と秘密管理先の準備が必要です。暗号化済みPDFに対する情報表示コマンドも、パスワードを表示する機能を避けて確認します。

Sources: [API token permission scopes](https://developers.cloudflare.com/fundamentals/api/reference/permissions/), [Worker roles](https://developers.cloudflare.com/workers/authorization/workers/), [binding permissions](https://developers.cloudflare.com/workers/authorization/), [Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/), [GitHub environment secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets), [qpdf Job JSON](https://qpdf.readthedocs.io/en/stable/qpdf-job.html).

ギフトの本番配布は`giftPolicy.myaspVerified`と`giftPolicy.distributionApproved`が両方trueで、合成教材ではない公開版だけに許可します。現在は両方falseです。商品の本番配布は、その商品の承認（`redmine-clone`は`productPolicy`、`task-app`は`taskAppPolicy`の`distributionApproved`。現在は両方true）がtrueで、合成教材ではない公開中の版だけに許可します。共有合言葉だけで回答者本人を個別確認する仕組みはありません。無料プレゼント（ギフト）については、MyASPの実設定の確認が終わるまで、全読者への案内や実教材の配信をしません。`npm run release:ready`は、ギフトも商品も1つも配れない状態のときに失敗（終了コード1）し、どちら側が止まっているかをメッセージに出します。配れない物は1行ずつ報告し、ほかに配れる物があれば成功（終了コード0）して、配れない物は本番で閉じたままである旨（`Note: … stays closed in production …`、閉じる物が2つ以上なら`stay`）を表示します。承認の旗は各コレクションの`approval`から読みます（Workerの判定と同じ`isApproved`）。ギフトを承認済みにしたのに配れない状態（合成教材のまま・公開中でない等）と、`validateManifest`が通らないマニフェスト（1行も出さずに止まります）も失敗します。
