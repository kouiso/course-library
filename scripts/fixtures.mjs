// Small synthetic files only. Never import production materials into this script.
import { crc32 } from 'node:zlib';
export const version = '0.1.0-synthetic';
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
  const books = Array.from({ length: 36 }, (_, i) => {
    const n = String(i + 1).padStart(2, '0');
    return [`taskapp-book-${n}.pdf`, pdf(`Taskapp book ${n}`)];
  });
  return new Map([
    ['taskapp-introduction.pdf', pdf('Taskapp introduction')], ...books,
    ['taskapp-books-01-36.zip', zip(books)],
    ['taskapp-starter.zip', zip([['README.txt', 'Synthetic starter. No real course source.\n'], ['src/main.ts', 'export const synthetic = true;\n']])],
    ['taskapp-example.zip', zip([['README.txt', 'Synthetic completed example. No real course source.\n'], ['src/main.ts', 'export const synthetic = true;\n']])],
  ]);
}
export async function seed(mf) {
  const bucket = await mf.getR2Bucket('MATERIALS');
  for (const [name, data] of fixtures()) await bucket.put(`releases/taskapp/${version}/${name}`, data);
}
