// يولّد قائمة الملفات المخزّنة مسبقًا ورقم إصدار الـ Service Worker من محتوى الملفات.
// الاستخدام:  node scripts/build-sw.mjs      (من جذر المشروع، بعد أي تعديل)
// لا يحتاج أي حزم خارجية. إن لم تشغّله فسيبقى المستخدمون على النسخة القديمة المخزنة.

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXCLUDE_DIRS = new Set(['scripts', 'docs', 'tests', 'node_modules', '.git']);
const EXCLUDE_FILES = new Set(['sw.js', 'README.md', '.gitignore', '.nojekyll']);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) { if (!EXCLUDE_DIRS.has(name)) out.push(...walk(full)); }
    else if (!EXCLUDE_FILES.has(name) && !name.endsWith('.zip')) out.push(full);
  }
  return out;
}

const files = walk(root).map((f) => relative(root, f).split(sep).join('/'));
const hash = createHash('sha256');
for (const f of files) { hash.update(f); hash.update(readFileSync(join(root, f))); }
const version = hash.digest('hex').slice(0, 12);

const swPath = join(root, 'sw.js');
let sw = readFileSync(swPath, 'utf8');
const list = ['./', ...files].map((f) => `  ${JSON.stringify(f)}`).join(',\n');
sw = sw.replace(/\/\*VERSION_START\*\/[\s\S]*?\/\*VERSION_END\*\//, `/*VERSION_START*/const VERSION = '${version}';/*VERSION_END*/`);
sw = sw.replace(/\/\*PRECACHE_START\*\/[\s\S]*?\/\*PRECACHE_END\*\//, `/*PRECACHE_START*/const PRECACHE = [\n${list},\n];/*PRECACHE_END*/`);
writeFileSync(swPath, sw);
console.log(`sw.js محدَّث: الإصدار ${version} — ${files.length} ملفًا في التخزين المسبق`);
