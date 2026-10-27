// Make the 3D text labels work offline.
//
// troika-three-text picks fallback fonts with unicode-font-resolver, which
// fetches an index, font metadata and .woff files from a CDN the first time a
// label is drawn. Offline that fetch fails and the designer never finishes
// loading. This copies the files Latin, Greek and Cyrillic text needs into the
// build and points the resolver at them.
//
//   node scripts/vendor-unicode-fonts.mjs <dist dir> [data base URL]

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const CDN = 'https://cdn.jsdelivr.net/gh/lojjic/unicode-font-resolver@v1.0.1/packages/data';
const [dist, base = CDN] = process.argv.slice(2);
if (!dist) throw new Error('usage: vendor-unicode-fonts.mjs <dist dir> [data base URL]');
const LOCAL = 'vendor/unicode-font-resolver';
const out = path.join(dist, LOCAL);
// Index files for Basic Latin through Geometric Shapes.
const LAST_CODEPOINT = 0x25ff;

async function fetchFile(rel) {
  const res = await fetch(`${base}/${rel}`);
  if (!res.ok) throw new Error(`${res.status} for ${rel}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  await mkdir(path.dirname(path.join(out, rel)), { recursive: true });
  await writeFile(path.join(out, rel), bytes);
  return bytes;
}

for (let start = 0; start <= LAST_CODEPOINT; start += 256) {
  await fetchFile(`codepoint-index/plane0/${start.toString(16)}-${(start + 255).toString(16)}.json`);
}
// The index files name fonts for every script that shares a range; only the
// European scripts and symbols are kept, which is what labels and dimensions use.
const FONTS = ['latin', 'latin-ext', 'greek', 'greek-ext', 'cyrillic', 'cyrillic-ext', 'vietnamese', 'symbols', 'math'];

let files = 0;
let fonts = 0;
for (const id of FONTS) {
  const res = await fetch(`${base}/font-meta/${id}.json`);
  if (!res.ok) throw new Error(`${res.status} for font-meta/${id}.json`);
  const [, meta] = await res.json();
  await mkdir(path.join(out, 'font-meta'), { recursive: true });
  await writeFile(path.join(out, 'font-meta', `${id}.json`), JSON.stringify([1, meta]));
  fonts++;
  // Labels are drawn sans-serif, normal style; keep every weight so the
  // resolver's nearest-weight choice always finds its file.
  const category = meta.typeforms['sans-serif'] ? 'sans-serif' : Object.keys(meta.typeforms)[0];
  const style = meta.typeforms[category].normal ? 'normal' : Object.keys(meta.typeforms[category])[0];
  for (const weight of meta.typeforms[category][style]) {
    await fetchFile(`font-files/${id}/${category}.${style}.${weight}.woff`);
    files++;
  }
}

// Point the resolver's default data URL at the copy. The resolver also runs
// inside a blob: worker, whose location.origin is still this page's origin.
const replacement = `(self.location.origin+"/${LOCAL}")`;
let patched = 0;
async function patch(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await patch(full);
    else if (entry.name.endsWith('.js')) {
      const text = await readFile(full, 'utf8');
      // The minifier may quote the literal with ", ' or `.
      const literal = new RegExp(`(["'\`])${CDN.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}\\1`, 'g');
      if (literal.test(text)) {
        await writeFile(full, text.replace(literal, replacement));
        patched++;
      } else if (text.includes(replacement)) {
        patched++; // already patched by an earlier run
      }
    }
  }
}
await patch(path.join(dist, 'assets'));
if (!patched) throw new Error('No bundle references the unicode-font-resolver CDN; the patch needs updating');
console.log(`Vendored ${fonts} fonts (${files} files) and patched ${patched} bundle file(s)`);
