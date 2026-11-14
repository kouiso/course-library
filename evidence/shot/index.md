# 画面の前後の画像

ダミーの固定データだけで撮った。合言葉はローカル用のダミー。幅は 1280x800（desktop）と 390x844（mobile）。
ファイル名: `<ブランチ名のスラッシュをハイフンに>-[状態-]<before|after>-<desktop|mobile>.png`
before は親の先端、after はそのブランチの先端。

| ブランチ | 状態 | 前（親・先端） | 後（先端） | 見せている画面 |
|---|---|---|---|---|
| fix/48-entry-expiry | 無印 | fix/40-phrase-setting-shape dcf904b | 6da03f8 | 入口を開いて10分過ぎた後に送信。前: 403「入口からもう一度お試しください」。後: 入口が出し直され「時間がたったので、もう一度入力してください。」 |
| fix/29-logout-without-session | 無印 | fix/48-entry-expiry 6da03f8 | ac07bfb | セッションの Cookie が無い状態で「閉じる」を押す。前: /logout で 403。後: /closed の閉じた画面 |
| fix/50-key-screen-button | locked | fix/29-logout-without-session ac07bfb | a15bdc2 | ギフトの合言葉で入り、商品の教材を開いた鍵の画面（主ボタンの文言と注記が変わる） |
| fix/50-key-screen-button | 無印 | 同上 | 同上 | 鍵の画面の主ボタンを押した後。前: /library に戻り入力欄なし。後: /phrase に入力欄と注記 |
| fix/45-basic-auth-hint | 無印 | fix/50-key-screen-button a15bdc2 | 86b4897 | 外側の認証を通っていない時の 401「認証が必要です」。後に案内の一文が増える |
| fix/42-buyer-wording | 無印 | fix/52-browser-check 9bd7b80 | 1fcd677 | 入口の画面（文言と見出しとヘッダーの言い方） |
| fix/42-buyer-wording | catalogue-buyer | 同上 | 同上 | 商品の合言葉で入った後の教材一覧（見出しがギフト向けから購入者向けへ） |
| fix/56-product-page | 無印 | fix/42-buyer-wording 1fcd677 | 6016f5a | 商品ページ（Redmineクローン教材）。含まれる物と確かめた環境が箇条書き、版と日付が出る |
| fix/57-versioned-download-name | 無印 | fix/56-product-page 6016f5a | f82c040 | 商品ページ。保存されるファイル名（版入り）と展開後の案内の一行が増える |

## 撮り方と注意
- 各先端をビルドし、同じ固定データで起動した（ギフトの合言葉と、商品用のダミー合言葉の2つ）。ブラウザは Chrome のヘッドレス。
- `npm run dev` は商品の合言葉を持たないので、同じ起動部品（scripts/runtime.mjs と fixtures.mjs）に商品用のダミー合言葉の設定だけ足して起動した。
- fix/45 は本番の動き（外側の認証あり）を再現するため、本番設定のまま画面を取り込んだ。この画面は CSS も認証の外で 401 になるので、装飾なしの素の表示になる（本番でも同じ）。
- fix/48 の「10分過ぎ」は、同じ署名鍵で期限切れの確認用の値を作って送った。実際に10分は待っていない。
- 画面にはアプリの表示だけが映る。ローカルのパスも実際の合言葉も無い。

## 追加: 1440 幅（desktop1440 = 1440x900）
fix/50 と fix/56 の課題が 1440px と 390px を求めるため、デスクトップだけ 1440x900 で撮り直した。同じ方法、同じ前後の先端。mobile（390x844）は上の画像を使う。
- fix/50-key-screen-button: `fix-50-key-screen-button-locked-<before|after>-desktop1440.png`（鍵の画面）、`fix-50-key-screen-button-<before|after>-desktop1440.png`（主ボタンを押した後）
- fix/56-product-page: `fix-56-product-page-<before|after>-desktop1440.png`（商品ページ）
