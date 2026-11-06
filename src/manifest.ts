// Explicit distribution policy: Taskapp is a paid product, never a survey gift.
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
export const productPolicy = {
  distributionApproved: true,
};
export const productRelease = {
  schemaVersion: 1,
  version: '0.1.0',
  date: '2026-11-05',
  synthetic: false,
  prefix: 'releases/redmine-clone/0.1.0/',
  verification: {
    delivery: 'macOS 実機と Linux コンテナで配布物のセットアップを検証しています。',
    materials: 'Day0 の骨格 ZIP で、完成品の app/ は含みません。',
    platforms: 'Windows / WSL での実走は未検証です。',
  },
} as const;
export type Material = { id: string; title: string; filename: string; type: 'application/pdf' | 'application/zip'; group: 'intro' | 'books' | 'exercises' | 'bundle' };
export type Collection = { id: string; title: string; description: string; distribution: 'survey-gift' | 'paid-product'; audience: string; status: 'preview' | 'pending' | 'published'; version: string | null; release: Release | null; materials: Material[]; cover: string; mark: string };
export const exerciseChapterIds = ['01', '02', '03', '04', '05', '06', '07', '08', '10'];
export const materials: Material[] = [
  { id: 'learning-flow', title: '学習の進め方', filename: 'typescript-learning-flow.pdf', type: 'application/pdf', group: 'intro' },
  ...Array.from({ length: 10 }, (_, i): Material => {
    const n = String(i + 1).padStart(2, '0');
    return { id: `chapter-${n}`, title: `第${n}章`, filename: `typescript-chapter-${n}.pdf`, type: 'application/pdf', group: 'books' };
  }),
  ...exerciseChapterIds.map((n): Material => {
    return { id: `exercise-${n}`, title: `練習問題 ${n}`, filename: `typescript-exercise-${n}.pdf`, type: 'application/pdf', group: 'exercises' };
  }),
  { id: 'all-materials', title: 'ダミー教材をまとめて保存', filename: 'typescript-all-materials.zip', type: 'application/zip', group: 'bundle' },
];
export const collections: Collection[] = [
  { id: 'typescript', title: 'TypeScript教材', description: 'アンケートにお答えいただいた方への無料プレゼントです。', distribution: 'survey-gift', audience: 'survey-respondents', status: 'preview', version: release.version, release, materials, cover: 'Make types\nyour ally.', mark: 'TS' },
  {
    id: 'redmine-clone', title: 'Redmineクローン教材', description: '30日で学ぶフルスタック開発教材のソースコードです。', distribution: 'paid-product', audience: 'buyers', status: 'published', version: productRelease.version, release: productRelease, cover: 'Build a\nRedmine clone.', mark: 'RM',
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
export function phraseEnvName(c: Collection): string {
  return isPaidProduct(c) ? `ACCESS_PHRASE_SHA256_${c.id.toUpperCase().replaceAll('-', '_')}` : 'ACCESS_PHRASE_SHA256';
}
export function canDistribute(c: Collection, local: boolean): boolean {
  if (!isSurveyGift(c) || !c.release || c.status === 'pending') return false;
  if (c.release.synthetic) return local;
  return c.status === 'published' && giftPolicy.myaspVerified && giftPolicy.distributionApproved;
}
export function canDistributeProduct(c: Collection): boolean {
  return isPaidProduct(c) && !!c.release && !c.release.synthetic
    && c.status === 'published' && productPolicy.distributionApproved;
}
export function validMaterial(m: Material): boolean {
  return /^[a-z0-9][a-z0-9-]{0,63}$/.test(m.id)
    && /^[a-z][a-z0-9-]{0,100}\.(pdf|zip)$/.test(m.filename)
    && ((m.type === 'application/pdf' && m.filename.endsWith('.pdf')) || (m.type === 'application/zip' && m.filename.endsWith('.zip')));
}
export function validateManifest(): void {
  if (new Set(collections.map(c => c.id)).size !== collections.length) throw new Error('Duplicate collection');
  for (const c of collections) {
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(c.id) || (!isSurveyGift(c) && !isPaidProduct(c))) throw new Error('Not an approved collection');
    if (isPaidProduct(c) && (c.audience !== 'buyers' || !/^[A-Z0-9_]+$/.test(phraseEnvName(c)))) throw new Error('Invalid product collection');
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
