# TDTS・XDTSの互換性確認

## 確認資料（2026-10-12）

- [CELSYS公式配布・更新履歴](https://www.clipstudio.net/ja/dl/toeianimation/): Windows版3.8.0、2025-01-28更新。
- [公式XDTS仕様・2018-11-29](https://vd.clipstudio.net/clipcontent/paint/app/ToeiAnimation/XDTSFileFormat_ja.pdf): version 5。
- [公式XDTS仕様・2022-12-06](https://vd.clipstudio.net/clipcontent/paint/app/ToeiAnimation/XDTSFileFormat_ver10_ja.pdf): version 5 / 10。英語版は同じディレクトリの`XDTSFileFormat_ver10_en.pdf`。
- [CELSYS公式操作説明](https://tips.clip-studio.com/ja-jp/articles/1372): ACTION・CELL欄、セル名の変換オプション、カメラ情報。
- TDTSの公開JSON Schemaは上記配布ページでは確認できなかった。TDTS v5の直下の`timeTables`、v7以降の`timeSheets`、ACTION=0/CELL=4、改訂履歴の扱いは、[公開コンバーターの実装](https://github.com/kiyo-nekomataya/remaping/blob/master/www/nas/lib/lib_TDTS.js)を参考にした。これは公式仕様書ではない。
- 公式3.8.0インストーラー同梱マニュアルもローカルで確認した。CELL欄は数字と空セル、ACTION欄は文字列・中割に対応する。インストーラーや同梱ファイルはリポジトリに再配布しない。

## 読み込み・保存

| 形式 | 読み込みの確認対象 | 保存 |
|---|---|---|
| XDTS | 公式version 5 / 10、既存DiTiSが書き出したversion 11 | 新規は5、読み込んだ10およびカメラ座標を含むデータは10。DiTiS独自の11は5/10へ修正 |
| TDTS | version 5の直下`timeTables`、version 7 / 10 / 11の`timeSheets` | 新規は旧版と交換しやすい5のACTION欄。読み込んだファイルは元のversion・欄を維持 |

- ファイルの識別行は必須。UTF-8 BOM・CRLFを受け付ける。
- `frame` / `trackNo`は0始まり。列名は配列順ではなく`names[trackNo]`で対応させ、空列を残す。
- セル名は文字列のまま保持する。`a0001`、`001`、`BG12`を数値へ変換しない。
- `SYMBOL_NULL_CELL`↔`×`、`SYMBOL_TICK_1`↔`○`、`SYMBOL_TICK_2`↔`●`を変換する。`SYMBOL_HYPHEN`は前の指示の継続として読み込む。
- 指定のないフレームは前の指示をシート末尾まで保持する。保存時は空白に移るフレームを明示し、未入力フレームが前のセルを誤って延長しないようにする。
- TDTSのCELLに実データがあればCELLを表示し、なければACTIONを表示する。両欄を同時に編集するUIは今回追加しない。読み込んだCELL欄に文字列や中割を入力した場合、非対応のTDTSを書き出さず保存を拒否する（XDTS/DiTiSで保存できる）。
- TDTSの各`timeSheets`では最後の改訂`timeTable`を表示し、保存時には過去の改訂も保持する。XDTSは全`timeTables`を独立したシートとして読み込む。
- 同じ形式で保存すると、未編集の欄（セリフ・カメラ等）、ヘッダー、フリー情報、セル指示に付属するメモ・色などを保持する。これらは専用の編集UIを持たない。`.ditis`を経由しても元の情報を保持する。
- 表示中のセル欄のメモ・色は、行の挿入・削除・データシフトに合わせて移動し、削除された指示の注釈は除く。Undo/Redoでも対応を復元する。未編集の欄と過去のTDTS改訂は元の情報を保持する。
- シート単位の保存なので、複数シートを含むファイルから保存する対象は現在のタブ。全タブ一括保存ではない。異なる形式への変換ではセル欄のみを生成する。
- 公開仕様にFPS属性はない。読み込みは24fps。24fps以外の保存はエラーとして拒否し、速度を黙って変えない。

## 検証と限界

- `npm run test:run`: ソース本体をVMで実行し、旧版構造・複数シート・改訂履歴・列番号・指示ID・記号・末尾の保持・不正入力の一括拒否・非セル情報の保存を検証する。XDTS出力は公式文書の構造制約を独立して記述したJSON Schemaで検証する。
- `node tools/basic-smoke.mjs`: Chromiumの実UIで基本操作と旧版構造の入力例を検証する。ネイティブI/Oはモック。`SMOKE_SCREENSHOT_PATH`で画面を保存できる。
- `node tools/windows-smoke.mjs`: ビルドしたWindowsアプリのWebView2と実RustファイルI/Oで、同じ基本操作・旧版入力例を確認する。CIのモーダルダイアログは置き換える。
- 旧版入力例は仕様・構造から独自に作った合成データ。旧版東映アプリやCLIP STUDIO PAINTでの実ファイル交換、手書き画像、全TDTS拡張の完全な適合性は未検証。公開TDTS仕様書がない範囲は完全準拠と断定しない。
- 今回のPR専用Windows Actionsは1ジョブにまとめ、同じPRの古い実行をキャンセルする。Mac対応PR #4の一般チェックへ統合する際は`runFormatOperations`も呼ぶようにし、この専用ワークフローの重複実行を避ける。
- リリース用ワークフロー、タグ、配布用バージョン、アップデーターの公開先は変更しない。PR作成・検証だけでは既存ユーザーへ更新は配信されない。
