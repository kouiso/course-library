// 型だけの検査。npm run typecheck で、秘密の設定値の名前の綴りの間違いが型エラーになる事を確かめる。
// 型エラーを期待する印を付けた行で型エラーが起きなくなると、typecheck が失敗する。Worker には取り込まれない。
import type { GiftLevelEnvName, PhraseEnvName, Secrets } from './manifest';

type SecretName<Name extends keyof Secrets> = Name;
type ProductPhrase<Name extends PhraseEnvName> = Name;

export type GiftLevelNamesAreSecrets = SecretName<GiftLevelEnvName>;
export type FirstGiftLevel = SecretName<'ACCESS_PHRASE_SHA256_TYPESCRIPT_01'>;
export type LastGiftLevel = SecretName<'ACCESS_PHRASE_SHA256_TYPESCRIPT_10'>;
export type Product = ProductPhrase<'ACCESS_PHRASE_SHA256_REDMINE_CLONE'>;

// @ts-expect-error ギフトの id の綴りを間違えた段の名前
export type MisspelledGift = SecretName<'ACCESS_PHRASE_SHA256_TYPSCRIPT_01'>;
// @ts-expect-error 段は 01〜10 だけ（ゼロ埋めの無い名前も通さない）
export type UnpaddedLevel = SecretName<'ACCESS_PHRASE_SHA256_TYPESCRIPT_1'>;
// @ts-expect-error 11 段目は無い
export type EleventhLevel = SecretName<'ACCESS_PHRASE_SHA256_TYPESCRIPT_11'>;
// @ts-expect-error 商品の名前の綴りの間違い
export type MisspelledProduct = ProductPhrase<'ACCESS_PHRASE_SHA256_REDMINE_CLONES'>;
// @ts-expect-error 段の合言葉の名前は、商品の phraseEnv には書けない
export type GiftLevelAsProduct = ProductPhrase<'ACCESS_PHRASE_SHA256_TYPESCRIPT_01'>;
