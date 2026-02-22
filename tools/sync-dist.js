#!/usr/bin/env node
// dist/ へのファイル同期スクリプト
// js/*.js, css/*.css, index.html を dist/ にコピーする

import { copyFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

const targets = [
  { src: join(ROOT, 'js'),       dst: join(ROOT, 'dist', 'js'),  ext: '.js'  },
  { src: join(ROOT, 'css'),      dst: join(ROOT, 'dist', 'css'), ext: '.css' },
  { src: ROOT,                   dst: join(ROOT, 'dist'),         file: 'index.html' },
];

let count = 0;
for (const t of targets) {
  mkdirSync(t.dst, { recursive: true });
  if (t.file) {
    copyFileSync(join(t.src, t.file), join(t.dst, t.file));
    console.log(`copied: ${t.file} → dist/${t.file}`);
    count++;
  } else {
    for (const f of readdirSync(t.src)) {
      if (!f.endsWith(t.ext)) continue;
      const src = join(t.src, f);
      if (statSync(src).isDirectory()) continue;
      copyFileSync(src, join(t.dst, f));
      console.log(`copied: ${f.replace(ROOT, '')} → dist/${basename(t.dst)}/${f}`);
      count++;
    }
  }
}
console.log(`\n✅ ${count} files synced to dist/`);
