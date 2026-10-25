# 初回公開の準備

この文書は準備用です。認証情報の作成や設定、リソース作成、公開を実行するものではありません。

## 決めることは3つ

1. **配布対象**：無料プレゼントはアンケート回答者向けTypeScript教材だけです。Taskappは販売商品なので、この無料ライブラリへ混在させません。TypeScriptの実配布版とMyASPの回答者向け案内設定を確認します。
2. **公開先**：既存の本人アカウントに新しいWorkerと私有R2を作ります。既存の別サービス用リソースは使いません。最初は既存の`workers.dev`サブドメインを使うとDNS設定を減らせます。
3. **秘密情報の安全な保管先**：利用者が管理する既存の秘密管理先を指定します。値をチャット、公開Git、コマンド引数、ログに貼らない方法を使います。

契約プランと利用上限は、金額を表示せずに別途確認します。APIの`type: standard`や`default_usage_model: standard`は契約プランの証明にはなりません。確認できない場合に、購入やプラン変更を進めることはありません。

## 用意する秘密情報

| 種類 | 用途 | 最終的な保存先 |
| --- | --- | --- |
| アクセス用の合言葉 | サイトに入る。十分にランダムな128ビット以上の値を使う | 元の値は利用者の秘密管理先。SHA-256ダイジェストだけをWorkerの`ACCESS_PHRASE_SHA256`へ |
| セッション署名鍵 | 有効期限付きCookieを署名する。32ランダムバイト以上 | Workerの`SESSION_SECRET`と利用者の秘密管理先 |
| PDFの開封パスワード | 確認済みの同一配布版のPDFを開く | 利用者の秘密管理先と、別途承認された読者向け案内。WorkerやGitHubへ保存する必要はない |
| PDFの所有者パスワード | 暗号化コピーの管理。開封用とは別のランダム値 | 利用者の秘密管理先のみ |
| Cloudflareデプロイトークン（継続CDを別途許可した場合だけ） | 検証済みコードをGitHubから自動配布する | `kouiso/course-library`の`production`環境シークレット。初回の手動公開には新規トークンを前提としない |

合言葉、PDF用パスワード、署名鍵、デプロイトークンは使い回しません。PDFの印刷やコピーは利用可能なままにします。

## 初回は既存接続で手動公開する

既存のCloudflare接続は、Workerのアップロード・版作成・デプロイ、R2バケット作成・オブジェクトアップロードに対応するAPIを呼べます。APIの対応と実アカウントでの書き込み許可は別なので、変更による権限テストは行いません。初回公開のために新規の継続用APIトークンを先に作る必要はありません。

1. 対象アカウント・新Worker・新しい私有R2を指定する。新しい権限や課金を発生させずに実行できること、契約と利用上限を先に確認する。既存接続で拒否された操作は、勝手に権限を増やさず報告する。
2. アプリ用の秘密値の保存先を、対象WorkerのSecret型バインディング`ACCESS_PHRASE_SHA256`と`SESSION_SECRET`として確定する。合言葉の元の値や保管用コピーは、利用者が指定した既存の秘密管理先で扱う。
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

本番配布は`giftPolicy.myaspVerified`と`giftPolicy.distributionApproved`が両方trueで、合成教材ではない公開版だけに許可します。現在は両方falseです。共有合言葉だけで回答者本人を個別確認する仕組みはありません。MyASPの実設定の確認が終わるまで、全読者への案内や実教材の配信をしません。`npm run release:ready`が失敗する現在の状態は意図した停止です。
