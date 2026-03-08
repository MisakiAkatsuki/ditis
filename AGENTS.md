# AGENTS.md

## 言語

- 思考・レスポンスは指定がない限り、基本的に日本語で行ってください。

## 作業効率

- 並列作業が可能なときはsubagentを起動して効率的に作業を行ってください。

## リリース手順

- リリース前に必ず `package.json` の `build` フィールドをインクリメントすること。
- その後 `node tools/bump-version.js` を実行して `tauri.conf.json` / `Cargo.toml` / `index.html` に反映する。
- `build` フィールドの更新を忘れると `latest.json` のバージョンが変わらず、Tauri updater が更新を検出できなくなる。
