# 初回公開の準備

この文書は準備用です。認証情報の作成や設定、リソース作成、公開を実行するものではありません。

## 決めることは3つ

1. **配布対象**：どの講座の、どの版をプレゼントにするか。商品フォルダーにあることだけでは無料配布の許可にはしません。
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
| Cloudflareデプロイトークン | 検証済みコードをCIから配布する | `kouiso/course-library`の`production`環境シークレット`CLOUDFLARE_API_TOKEN`。アカウントIDは`CLOUDFLARE_ACCOUNT_ID`へ |

合言葉、PDF用パスワード、署名鍵、デプロイトークンは使い回しません。PDFの印刷やコピーは利用可能なままにします。

## 承認後の準備をまとめる

最小権限にするため、必要な準備を1回の承認対象として提示します。ただし実行時に、対象アカウント、Worker名、バケット名、秘密管理先、トークン権限と保存先を明記します。

1. 既存の認証を使って、**未デプロイ・非公開のWorkerメタデータ**と**空の私有R2バケット**を作成する。Workerの`workers.dev`とプレビューを無効のままにする。R2の公開アクセス、公開カスタムドメイン、CORSは有効にしない。
2. 作成済みの新Workerだけにスコープを限定した、期限付きの**Individual Worker Editor**デプロイトークンを作成する。継続用CIにWorkers Admin、他Worker、R2オブジェクト操作、DNS、Billing、メンバー管理の権限を与えない。R2のランタイムアクセスはWorkerバインディングで行う。古い汎用テンプレートへ勝手に権限を広げない。
3. 利用者が指定した秘密管理先で値を用意し、GitHubの`production`環境にCI用トークンとアカウントIDだけを保存する。秘密値の非表示受け渡しが使えない場合は、本人による専用シークレット入力を最小限の操作として依頼する。別タスクの認証要求を再送・流用しない。
4. Workerの合言葉ダイジェストと署名鍵は、**別途許可された未デプロイの版アップロード**で安全な`--secrets-file`入力を使うか、最初の承認済みデプロイと同時に設定する。秘密ファイルが必要なら公開リポジトリの外に、所有者だけが読める一時ファイルとして作り、処理後に自身の一時ファイルだけを片付ける。

通常の`wrangler secret put`は新しい版を**即時デプロイ**します。公開しない準備には使いません。既存の版に対する`wrangler versions secret put`や`wrangler versions upload --secrets-file`は版作成と配信開始を分けるための候補です。初回の対象Workerの状態とCLIの動作を確認してから選びます。

Workerの新規作成と、作成済みWorkerへの継続デプロイは権限が異なります。新規作成に必要な一時的な既存管理権限を、継続用CIトークンに残しません。API接続の書き込み権限は読み取り成功やアカウントの管理者ロールだけでは確認できないため、拒否された場合は権限拡張せず報告します。

## 公開はさらに次の段階

上の準備では、アプリ配信、実教材の暗号化・アップロード、Actions実行、読者への連絡をしません。教材の対象確認と安全な配布コピー作成、実契約・上限確認、同一コミットの検証が揃ってから、公開範囲と配信開始を承認します。

PDF暗号化ツールは現在の公式版を使い、秘密値を引数に置かない方法を選びます。qpdfのJob JSON入力は候補ですが、実行環境の導入・確認と秘密管理先の準備が必要です。暗号化済みPDFに対する情報表示コマンドも、パスワードを表示する機能を避けて確認します。

Sources: [Worker roles](https://developers.cloudflare.com/workers/authorization/workers/), [binding permissions](https://developers.cloudflare.com/workers/authorization/), [Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/), [GitHub environment secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets), [qpdf Job JSON](https://qpdf.readthedocs.io/en/stable/qpdf-job.html).
