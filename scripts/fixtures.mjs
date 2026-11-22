// Small synthetic files only. Never import production materials into this script.
import { crc32 } from 'node:zlib';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
export const version = '0.2.2-synthetic';
export function pdf(label) {
  const stream = `BT /F1 16 Tf 45 760 Td (${label} - SYNTHETIC PLACEHOLDER ONLY) Tj ET`;
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let text = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) { offsets.push(text.length); text += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`; }
  const xref = text.length;
  text += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(text);
}
// ZIP STORE format; local, central and EOCD records. No external ZIP dependency.
export function zip(entries) {
  const local = [], central = [];
  let offset = 0;
  for (const [name, input] of entries) {
    const filename = Buffer.from(name), bytes = Buffer.from(input), crc = crc32(bytes);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(bytes.length, 18); header.writeUInt32LE(bytes.length, 22); header.writeUInt16LE(filename.length, 26);
    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50); dir.writeUInt16LE(20, 4); dir.writeUInt16LE(20, 6); dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(bytes.length, 20); dir.writeUInt32LE(bytes.length, 24); dir.writeUInt16LE(filename.length, 28); dir.writeUInt32LE(offset, 42);
    local.push(header, filename, bytes); central.push(dir, filename);
    offset += header.length + filename.length + bytes.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}
export function fixtures() {
  const chapters = Array.from({ length: 10 }, (_, i) => {
    const n = String(i + 1).padStart(2, '0');
    return [`typescript-chapter-${n}.pdf`, pdf(`Synthetic TypeScript chapter ${n}`)];
  });
  const exercises = ['01', '02', '03', '04', '05', '06', '07', '08', '10'].map(n => {
    return [`typescript-exercise-${n}.pdf`, pdf(`Synthetic TypeScript exercise ${n}`)];
  });
  const files = [['typescript-learning-flow.pdf', pdf('Synthetic TypeScript learning flow')], ...chapters, ...exercises];
  return new Map([...files, ['typescript-all-materials.zip', zip(files)]]);
}
// The paid products keep their real release prefixes, so the local preview can open and download them.
// Versions are read from src/manifest.ts so fixtures can never drift from what the Worker serves.
const manifestSource = stripTypeScriptTypes(await readFile(new URL('../src/manifest.ts', import.meta.url), 'utf8'));
const { collections, isPaidProduct, redmineCloneRelease } = await import('data:text/javascript;base64,' + Buffer.from(manifestSource).toString('base64'));
export const productVersion = redmineCloneRelease.version;
export function productFixtures() {
  const readme = 'SYNTHETIC PLACEHOLDER ONLY. This ZIP is a local dummy, not the real product source.\n';
  const files = new Map();
  for (const course of collections.filter(isPaidProduct))
    for (const m of course.materials)
      files.set(`${course.release.prefix}${m.filename}`, zip([[`${m.filename.replace(/\.zip$/, '')}/README.txt`, readme]]));
  return files;
}
export async function seed(mf) {
  const bucket = await mf.getR2Bucket('MATERIALS');
  for (const [name, data] of fixtures()) await bucket.put(`releases/typescript/${version}/${name}`, data);
  for (const [key, data] of productFixtures()) await bucket.put(key, data);
}
