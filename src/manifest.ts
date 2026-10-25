export const release = {
  schemaVersion: 1,
  version: '0.1.0-synthetic',
  date: '2026-10-25',
  synthetic: true,
  prefix: 'releases/taskapp/0.1.0-synthetic/',
  verification: {
    delivery: 'MacのローカルWorkerとChromiumで配布機能を確認済みです。',
    materials: '教材コードはダミーのため、実教材の動作は未検証です。',
    platforms: 'Windows / WSLと実教材のPDFリーダー互換性は未検証です。',
  },
} as const;

export type Release = { schemaVersion: number; version: string; date: string; synthetic: boolean; prefix: string; verification: { delivery: string; materials: string; platforms: string } };
export type Material = { id: string; title: string; filename: string; type: 'application/pdf' | 'application/zip'; group: 'intro' | 'books' | 'code' };
export type Collection = { id: string; title: string; description: string; status: 'preview' | 'pending' | 'published'; version: string | null; release: Release | null; materials: Material[]; cover: string; mark: string };
export const materials: Material[] = [
  { id: 'introduction', title: '講座のはじめ方', filename: 'taskapp-introduction.pdf', type: 'application/pdf', group: 'intro' },
  ...Array.from({ length: 36 }, (_, i): Material => {
    const n = String(i + 1).padStart(2, '0');
    return { id: `book-${n}`, title: `第${n}巻`, filename: `taskapp-book-${n}.pdf`, type: 'application/pdf', group: 'books' };
  }),
  { id: 'books-bundle', title: '全36巻をまとめてダウンロード', filename: 'taskapp-books-01-36.zip', type: 'application/zip', group: 'books' },
  { id: 'starter', title: 'スターターコード', filename: 'taskapp-starter.zip', type: 'application/zip', group: 'code' },
  { id: 'example', title: '完成例のソースコード', filename: 'taskapp-example.zip', type: 'application/zip', group: 'code' },
];

export function validMaterial(m: Material): boolean {
  return /^[a-z0-9][a-z0-9-]{0,63}$/.test(m.id)
    && /^[a-z][a-z0-9-]{0,100}\.(pdf|zip)$/.test(m.filename)
    && ((m.type === 'application/pdf' && m.filename.endsWith('.pdf')) || (m.type === 'application/zip' && m.filename.endsWith('.zip')));
}

export function validateManifest(): void {
  if (new Set(collections.map(c => c.id)).size !== collections.length) throw new Error('Duplicate collection');
  for (const c of collections) {
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(c.id)) throw new Error('Invalid collection');
    if (c.status === 'pending') {
      if (c.release || c.version || c.materials.length) throw new Error('Pending collection exposes materials');
      continue;
    }
    if (!c.release || !c.version || !/^[a-z0-9][a-z0-9.-]{0,63}$/.test(c.version)
      || c.release.version !== c.version || c.release.schemaVersion !== 1
      || c.release.prefix !== `releases/${c.id}/${c.version}/`
      || new Set(c.materials.map(m => m.id)).size !== c.materials.length
      || new Set(c.materials.map(m => m.filename)).size !== c.materials.length
      || c.materials.some(m => !validMaterial(m))) throw new Error('Invalid release manifest');
  }
}

export const collections: Collection[] = [
  { id: 'taskapp', title: 'Taskapp講座', description: '小さなアプリを作りながら、実装の流れを身につける。', status: 'preview', version: release.version, release, materials, cover: 'Build your\nfirst app.', mark: '{ }' },
  { id: 'typescript', title: 'TypeScript講座', description: '教材と配布対象を確認しています。公開までしばらくお待ちください。', status: 'pending', version: null, release: null, materials: [], cover: 'Make types\nyour ally.', mark: 'TS' },
];

export const collectionStatusLabel = (status: Collection['status']): string => ({ pending: '準備中', preview: '開発プレビュー', published: '公開中' })[status];
