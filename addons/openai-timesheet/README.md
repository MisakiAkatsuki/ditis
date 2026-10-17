# DiTiS AI Import（任意導入プラグイン）

DiTiSの「ファイル → プラグインから読み込み → 画像・PDFから読み込み（OpenAI）」から起動する、別配布の読み込みプラグインです。本体にはOpenAI依存・APIキー設定・OCRモデルを同梱しません。同じ実行ファイルを引数なしで起動すると単独の変換ツールとして使えます。

## 読み込みとプライバシー

- PNG・JPEG・WebP・TGA・PDFに対応します。TGAは端末内でPNGへ変換します。PDFもPDF.jsで端末内に描画します。
- 「自動検出」と「手動で選択」を選べます。自動検出は同梱した日本語OCR（Tesseract）と罫線解析を端末内で実行します。認識できない用紙では自動送信せず、手動指定を案内します。
- 原画欄・動画欄を切り出し、送信する画像を画面に表示します。不要な範囲を削除し、タイトル・カット名・スタッフ名などが含まれないことを確認してください。自動検出は一般的な罫線用紙を対象とする補助機能で、用紙ごとの完全な識別は保証しません。
- OpenAIへの送信処理は切り出したPNGだけを受け付けます。元画像・PDF本体・元ファイル名・ローカルのシート名は送りません。PNGはネイティブ側で再エンコードし、元ファイルのメタデータを残しません。OCR用のモデル・ワーカー・PDF資材はすべて同梱し、CDNへアクセスしません。
- 初期値は24fps・1ページ144コマです。ページ順、開始コマ、コマ数を用紙に合わせて確認してください。複数ファイルは選択した順に同じカットの続きとして扱います。
- 利用者自身のOpenAI APIキーと、画像入力・Structured Outputs対応モデルを設定します。初期モデル名は gpt-4.1 で、変更できます。APIキーはディスクへ保存しません。通信はネイティブ側からOpenAIのResponses APIへ直接行い、store=falseを指定します。この指定はOpenAI側のすべての保持を無効化する保証ではありません。
- 認識は明示的な「表示中の画像を送信して認識」操作でのみ実行します。API料金は利用者のアカウントに発生します。自動リトライはしません。
- 認識結果はコマ範囲とセル値を編集できます。不明・要確認の行は利用者が確認するまで取り込めません。原画と動画はそれぞれ別タブになります。現在のシートは置き換えません。

## 導入

プラグイン対応版のDiTiSが必要です。現行版へファイルを置くだけではメニューは追加されません。

1. DiTiSの「ファイル → プラグインから読み込み → プラグインフォルダーを開く」を選びます。
2. 対応OS・CPU向けにビルドした openai-timesheet フォルダーをその中へコピーします。フォルダー直下が plugin.json になる構成です。
3. 「プラグインを再読み込み」を選びます。「画像・PDFから読み込み（OpenAI）」が表示されます。
4. 削除する場合はプラグインを閉じ、そのフォルダーを削除して再読み込みします。

Windowsでは通常 %APPDATA%/com.ditis.application/plugins、macOSでは ~/Library/Application Support/com.ditis.application/plugins、Linuxでは ~/.local/share/com.ditis.application/plugins です。実際の場所はメニューから開いてください。

外部プラグインは通常の実行ファイルとして動きます。OSのアクセス権を持つため、信頼する配布元のものを導入してください。

## ビルド

リポジトリのルートで npm ci を実行し、Tauri 2の開発に必要なRust・OS依存ライブラリを用意します。その後、このディレクトリで以下を実行します。

    npm ci
    npm run build -- --no-bundle
    npm run package:plugin

plugin-package/openai-timesheet が配布用のフォルダーです。OS・CPUごとにビルドしてください。macOSのクロスビルドでは、ビルドとパッケージ作成で同じターゲットを指定します。

    npm run build -- --no-bundle --target aarch64-apple-darwin
    npm run package:plugin -- --target=aarch64-apple-darwin

単独利用では、Windows/Linuxは生成された実行ファイル、macOSは .app を起動し、確認後に .ditis ファイルへ保存します。署名・公証・リリース配布はこの実装には含めていません。

## 検証

ルートの npm run test:run と cargo test で、データ受け渡し、キャンセル、全件検証、TGAの向き・RLE、不要な情報を含まないAPI要求、不明範囲・重複コマの扱いを検証します。npm run build:ui の後、ルートの node tools/import-plugin-smoke.mjs はChromiumで画像の切り出し、ローカルOCR、PDF描画、確認後の取り込みを確認します。APIはモックし、実際の課金通信は行いません。実物のタイムシートによる認識精度と、各OSのネイティブ実行は別途確認が必要です。

PDF.js（Apache-2.0）、Tesseract.js/Tesseract.js-core（Apache-2.0）、日本語traineddataのライセンスに従って利用してください。配布資材には元パッケージのライセンスを含めます。
