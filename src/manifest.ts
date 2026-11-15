// 配布の承認は、コレクションごとに approval として持つ（Collection['approval']）。
// giftPolicy は TypeScript教材（ギフト）の承認。対象 id と audience もギフトの条件としてここに置く。
// Explicit distribution policy: Taskapp is a paid product, never a survey gift.
export type Approval = { distributionApproved: boolean; myaspVerified?: boolean };
export const giftPolicy = {
  allowedCourseIds: ['typescript'] as readonly string[],
  audience: 'survey-respondents',
  myaspVerified: false,
  distributionApproved: false,
};
export const release = {
  schemaVersion: 1,
  version: '0.2.2-synthetic',
  date: '2026-10-26',
  synthetic: true,
  prefix: 'releases/typescript/0.2.2-synthetic/',
  verification: {
    delivery: 'MacのローカルWorkerとChromiumで配布機能を検証しています。',
    materials: 'この画面の教材はダミーです。実教材と配布版は未検証です。',
    platforms: 'Windows / WSLと実教材のPDFリーダー互換性は未検証です。',
  },
} as const;
export type Release = { schemaVersion: number; version: string; date: string; synthetic: boolean; prefix: string; verification: { delivery: string; materials: string; platforms: string } };
// 商品の配布可否は商品側のフラグで別管理する（購入者への合言葉の渡し方が決まるまでは配らない）。
// productPolicy は Redmineクローン教材だけの承認。商品を足す時は、その商品用の承認を別に作る。
export const productPolicy = {
  distributionApproved: true,
};
export const productRelease = {
  schemaVersion: 1,
  version: '0.2.1',
  date: '2026-11-10',
  synthetic: false,
  prefix: 'releases/redmine-clone/0.2.1/',
  verification: {
    delivery: 'ZIP の中身が Day0 の骨格と一致することを検査で確かめています。',
    materials: 'Day0 の骨格 ZIP で、完成品の app/ は含みません。',
    platforms: 'Windows と macOS の実機での実走は未検証です。',
  },
} as const;
// 保存される時のファイル名。有料商品の ZIP だけ版を入れる（R2 のキーは filename のまま）。ギフトの PDF/ZIP は変えない。
export function saveName(course: Collection, material: Material): string {
  return course.distribution === 'paid-product' && course.release && material.filename.endsWith('.zip')
    ? material.filename.replace(/\.zip$/, `-v${course.release.version}.zip`)
    : material.filename;
}
export type Material = { id: string; title: string; filename: string; type: 'application/pdf' | 'application/zip'; group: 'intro' | 'books' | 'exercises' | 'bundle' };
// 秘密の設定値（wrangler secret で置く物）。生成物の worker-configuration.d.ts には出ないので、型はここ1か所で持つ。
// 商品を足す時は、ここに商品用の合言葉の名前を足し、マニフェストの phraseEnv に同じ名前を書く。
export type Secrets = {
  SESSION_SECRET?: string;
  BASIC_AUTH_USER?: string;
  BASIC_AUTH_PASS?: string;
  ACCESS_PHRASE_SHA256?: string;
  ACCESS_PHRASE_SHA256_REDMINE_CLONE?: string;
};
export type PhraseEnvName = Extract<keyof Secrets, `ACCESS_PHRASE_SHA256${string}`>;
export type Collection = { id: string; title: string; description: string; distribution: 'survey-gift' | 'paid-product'; audience: string; status: 'preview' | 'pending' | 'published'; version: string | null; release: Release | null; approval: Approval; materials: Material[]; cover: string; mark: string; phraseEnv?: PhraseEnvName };
export const exerciseChapterIds = ['01', '02', '03', '04', '05', '06', '07', '08', '10'];
export const materials: Material[] = [
  { id: 'learning-flow', title: '学習の進め方', filename: 'typescript-learning-flow.pdf', type: 'application/pdf', group: 'intro' },
  ...Array.from({ length: 10 }, (_, i): Material => {
    const n = String(i + 1).padStart(2, '0');
    return { id: `chapter-${n}`, title: `第${i + 1}章`, filename: `typescript-chapter-${n}.pdf`, type: 'application/pdf', group: 'books' };
  }),
  ...exerciseChapterIds.map((n): Material => {
    return { id: `exercise-${n}`, title: `練習問題 ${n}`, filename: `typescript-exercise-${n}.pdf`, type: 'application/pdf', group: 'exercises' };
  }),
  { id: 'all-materials', title: 'ダミー教材をまとめて保存', filename: 'typescript-all-materials.zip', type: 'application/zip', group: 'bundle' },
];
export const collections: Collection[] = [
  { id: 'typescript', title: 'TypeScript教材', description: 'アンケートにお答えいただいた方への無料プレゼントです。', distribution: 'survey-gift', audience: 'survey-respondents', status: 'preview', version: release.version, release, approval: giftPolicy, materials, cover: 'Make types\nyour ally.', mark: 'TS' },
  {
    id: 'redmine-clone', title: 'Redmineクローン教材', description: '30日で学ぶフルスタック開発教材のソースコードです。', distribution: 'paid-product', audience: 'buyers', status: 'published', version: productRelease.version, release: productRelease, approval: productPolicy, cover: 'Build a\nRedmine clone.', mark: 'RM', phraseEnv: 'ACCESS_PHRASE_SHA256_REDMINE_CLONE',
    materials: [{ id: 'source-zip', title: 'ソースコード一式（Day0 の骨格）', filename: 'redmine-clone-source.zip', type: 'application/zip', group: 'bundle' }],
  },
];
export function isSurveyGift(c: Collection): boolean {
  return c.distribution === 'survey-gift' && c.audience === giftPolicy.audience && giftPolicy.allowedCourseIds.includes(c.id);
}
export function isPaidProduct(c: Collection): boolean {
  return c.distribution === 'paid-product';
}
// 合言葉ごとにどのコレクションを開けるかを、環境変数名の約束で持つ。
// ギフトは従来どおり ACCESS_PHRASE_SHA256。商品は id ごとに
// ACCESS_PHRASE_SHA256_REDMINE_CLONE のような別の secret を置く（未設定なら開かない）。
// 商品の名前はマニフェストの phraseEnv に明示し、型検査で Secrets の名前と突き合わせる。
export const productPhraseEnvName = (id: string): string => `ACCESS_PHRASE_SHA256_${id.toUpperCase().replaceAll('-', '_')}`;
export function phraseEnvName(c: Collection): PhraseEnvName | undefined {
  return isPaidProduct(c) ? c.phraseEnv : 'ACCESS_PHRASE_SHA256';
}
// ギフトは段階の合言葉も持てる。N 段目（ACCESS_PHRASE_SHA256_TYPESCRIPT_0N、10 段目は _10）で 1〜N 章が開く。
// 従来の ACCESS_PHRASE_SHA256 は 10 段目と同じ扱い（ギフト全部）。段の secret が未設定なら、その段は誰にも合わない。
export const GIFT_LEVELS = 10;
export function giftLevelEnvName(c: Collection, level: number): string {
  return `ACCESS_PHRASE_SHA256_${c.id.toUpperCase().replaceAll('-', '_')}_${String(level).padStart(2, '0')}`;
}
// どの教材が何段目で開くか: 学習の進め方は 1 段目、第 N 章と練習問題 N は N 段目、まとめ ZIP は 10 段目。
export function giftMaterialLevel(m: Material): number | null {
  if (m.id === 'learning-flow') return 1;
  if (m.group === 'bundle') return GIFT_LEVELS;
  const match = /^(?:chapter|exercise)-(\d{2})$/.exec(m.id);
  const level = match ? Number(match[1]) : 0;
  return level >= 1 && level <= GIFT_LEVELS ? level : null;
}
export function canOpenMaterial(c: Collection, m: Material, giftLevel: number): boolean {
  if (!isSurveyGift(c)) return true;
  const level = giftMaterialLevel(m);
  return level !== null && level <= giftLevel;
}
// 配布してよいかの判定はこの関数1つに集める。配布の種類ごとの条件もここに書く。
// local はローカル実行かどうか。ダミー教材（synthetic）のギフトはローカルでだけ配る。
export function isDistributable(c: Collection, local: boolean): boolean {
  if (!c.release || c.status === 'pending') return false;
  if (isSurveyGift(c)) {
    if (c.release.synthetic) return local;
    return c.status === 'published' && c.approval.myaspVerified === true && c.approval.distributionApproved;
  }
  if (isPaidProduct(c)) return !c.release.synthetic && c.status === 'published' && c.approval.distributionApproved;
  return false;
}
export function canDistribute(c: Collection, local: boolean): boolean {
  return isSurveyGift(c) && isDistributable(c, local);
}
export function canDistributeProduct(c: Collection): boolean {
  return isPaidProduct(c) && isDistributable(c, false);
}
export function validMaterial(m: Material): boolean {
  return /^[a-z0-9][a-z0-9-]{0,63}$/.test(m.id)
    && /^[a-z][a-z0-9-]{0,100}\.(pdf|zip)$/.test(m.filename)
    && ((m.type === 'application/pdf' && m.filename.endsWith('.pdf')) || (m.type === 'application/zip' && m.filename.endsWith('.zip')));
}
export function validateManifest(): void {
  if (new Set(collections.map(c => c.id)).size !== collections.length) throw new Error('Duplicate collection');
  // The gift level in a session applies to every survey gift, so only one survey gift may exist.
  if (collections.filter(isSurveyGift).length > 1) throw new Error('Only one survey gift is supported');
  const phraseNames = collections.flatMap(c => [phraseEnvName(c), ...(isSurveyGift(c) ? Array.from({ length: GIFT_LEVELS }, (_, i) => giftLevelEnvName(c, i + 1)) : [])]);
  if (new Set(phraseNames).size !== phraseNames.length) throw new Error('Duplicate phrase setting');
  for (const c of collections) {
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(c.id) || (!isSurveyGift(c) && !isPaidProduct(c))) throw new Error('Not an approved collection');
    if (isPaidProduct(c) && (c.audience !== 'buyers' || c.phraseEnv !== productPhraseEnvName(c.id))) throw new Error('Invalid product collection');
    if (!isPaidProduct(c) && c.phraseEnv !== undefined) throw new Error('Invalid gift collection');
    if (isSurveyGift(c) && c.materials.some(m => giftMaterialLevel(m) === null)) throw new Error('Gift material without a level');
    if (c.status === 'pending') {
      if (c.release || c.version || c.materials.length) throw new Error('Pending collection exposes materials');
      continue;
    }
    if (!c.release || !c.version || !/^[a-z0-9][a-z0-9.-]{0,63}$/.test(c.version)
      || c.release.version !== c.version || c.release.schemaVersion !== 1
      || c.release.prefix !== `releases/${c.id}/${c.version}/`
      || new Set(c.materials.map(m => m.id)).size !== c.materials.length
      || new Set(c.materials.map(m => m.filename)).size !== c.materials.length
      || c.materials.some(m => !validMaterial(m) || !m.filename.startsWith(`${c.id}-`))) throw new Error('Invalid release manifest');
  }
}
export const collectionStatusLabel = (status: Collection['status']): string => ({ pending: '準備中', preview: '開発プレビュー', published: '公開中' })[status];
