#!/usr/bin/env node
/**
 * tools/bump-version.js
 *
 * package.json の version (YYYYMMDD) を読み取り、以下のファイルに反映する:
 *   - src-tauri/Cargo.toml
 *   - src-tauri/tauri.conf.json
 *   - index.html
 *
 * 使い方:
 *   npm run version:sync          # 単体実行
 *   tauri build (自動実行される)   # beforeBuildCommand 経由
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

// package.json からバージョン読み取り (形式: YYYYMMDD)
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const raw = pkg.version; // e.g. "20260222"

if (!/^\d{8}$/.test(raw)) {
  console.error(`❌ version の形式は YYYYMMDD にしてください (現在: ${raw})`);
  process.exit(1);
}

const build = pkg.build ?? 0;  // ビルド番号 (同日リリース用)

const yyyy = raw.slice(0, 4);        // "2026"
const mm   = raw.slice(4, 6);        // "02"
const dd   = raw.slice(6, 8);        // "22"
const yy   = raw.slice(2, 4);        // "26"
const mNum  = String(parseInt(mm));  // "2" (ゼロなし)
const dNum  = dd;                    // "22"

const tauriVer   = `${yy}.${mNum}.${dNum}.${build}`;  // "26.2.22.1" (Tauri/Cargo用)
const displayVer = `v${yyyy}.${mm}.${dd}`; // "v2026.02.22" (表示用)

// ─── 1. src-tauri/Cargo.toml ─────────────────────────────────────
const cargoPath = join(ROOT, 'src-tauri', 'Cargo.toml');
let cargo = readFileSync(cargoPath, 'utf8');
cargo = cargo.replace(/^version = "[\d.]+"/m, `version = "${tauriVer}"`);
writeFileSync(cargoPath, cargo);
console.log(`updated: Cargo.toml        → ${tauriVer}`);

// ─── 2. src-tauri/tauri.conf.json ────────────────────────────────
const tauriConfPath = join(ROOT, 'src-tauri', 'tauri.conf.json');
const tauriConf = JSON.parse(readFileSync(tauriConfPath, 'utf8'));
tauriConf.version = tauriVer;
tauriConf.app.windows[0].title = `DiTiS - ${displayVer}`;
writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
console.log(`updated: tauri.conf.json   → ${tauriVer}`);

// ─── 3. index.html ───────────────────────────────────────────────
const indexPath = join(ROOT, 'index.html');
let html = readFileSync(indexPath, 'utf8');
html = html.replace(
  /<meta name="version" content="\d+">/,
  `<meta name="version" content="${raw}">`
);
html = html.replace(
  /<title>DiTiS - v[\d.]+<\/title>/,
  `<title>DiTiS - ${displayVer}</title>`
);
html = html.replace(
  /window\.DITIS_VERSION = 'v[\d.]+'/,
  `window.DITIS_VERSION = '${displayVer}'`
);
html = html.replace(
  /window\.DITIS_BUILD = \d+/,
  `window.DITIS_BUILD = ${build}`
);
writeFileSync(indexPath, html);
console.log(`updated: index.html        → ${displayVer} build ${build}`);

console.log(`\n✅ version synced: ${raw} → ${displayVer}`);
