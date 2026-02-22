/**
 * print.js - 印刷機能
 * Ctrl+P でページ単位（framePageSize ごと）に現在のシートを印刷する
 */

/**
 * 現在のシートをページ単位で印刷する
 */
function printCurrentSheet() {
    const sheet = getCurrentSheet();
    const framePageSize = sheet.framePageSize || 144;
    const fps = AppState.fps || 24;
    const filter = AppState.frameFilter || 'all';
    const totalFrames = sheet.frames || 144;

    // validFrameCount マップを構築（無効フレームを除いた連番）
    const validCountMap = new Map();
    let count = 0;
    for (let f = 1; f <= totalFrames; f++) {
        if (!(sheet.disabledFrames && sheet.disabledFrames.includes(f))) count++;
        validCountMap.set(f, count);
    }

    // フレームをページ番号でグループ化
    const pageGroups = new Map();

    for (let frame = 1; frame <= totalFrames; frame++) {
        const isDisabled = sheet.disabledFrames && sheet.disabledFrames.includes(frame);
        const isInserted = sheet.insertedFrames && sheet.insertedFrames.includes(frame);

        // originalFrame を算出（挿入フレームを除いた実フレーム番号）
        let originalFrame = frame;
        if (!isInserted && sheet.insertedFrames) {
            const insertedBefore = sheet.insertedFrames.filter(f => f < frame).length;
            originalFrame = frame - insertedBefore;
        }

        // ページ番号とページ内コマ番号
        const pageNum   = Math.floor((originalFrame - 1) / framePageSize) + 1;
        const frameInPage = ((originalFrame - 1) % framePageSize) + 1;

        // フィルター判定（表示するかどうか）
        let showNumber = true;
        if (!isInserted && !isDisabled) {
            if (filter === 'odd'  && frameInPage % 2 === 0) showNumber = false;
            if (filter === 'even' && frameInPage % 2 === 1) showNumber = false;
        }

        // 太線（6コマ単位）
        const isBoldRow = !isInserted && originalFrame % 6 === 0;

        // セルデータ
        const cells = sheet.layers.map(layer => {
            const value = (sheet.data[frame] && sheet.data[frame][layer.id]) || '';
            if (value !== '' && frame > 1) {
                const prev = (sheet.data[frame - 1] && sheet.data[frame - 1][layer.id]) || '';
                if (value === prev) return '-';
            }
            return value;
        });

        if (!pageGroups.has(pageNum)) pageGroups.set(pageNum, []);
        pageGroups.get(pageNum).push({
            frame, originalFrame, isDisabled, isInserted, isBoldRow,
            pageNum, frameInPage, showNumber, cells
        });
    }

    // テーブルヘッダー行 HTML
    const thead = `<thead><tr>
        <th class="fc">fps<br><span class="sub">${fps}</span></th>
        ${sheet.layers.map((l, i) =>
            `<th>${escapeHtml(l.name)}<br><span class="sub">${i + 1}</span></th>`
        ).join('')}
    </tr></thead>`;

    // 各ページのテーブルを生成
    const sortedPages = [...pageGroups.entries()].sort(([a], [b]) => a - b);
    let tablesHtml = '';

    for (const [pageNum, rows] of sortedPages) {
        let tbodyRows = '';
        for (const row of rows) {
            const rowClass = row.isBoldRow ? ' class="bold-row"' : '';

            let label;
            if (row.isDisabled) {
                label = '-';
            } else if (row.isInserted) {
                const insertNum = (sheet.insertedFrameMap && sheet.insertedFrameMap[row.frame]) || '?';
                label = `<span class="ins">+${insertNum}</span>`;
            } else if (row.showNumber) {
                label = `${row.pageNum}.${row.frameInPage}`;
            } else {
                label = `${row.pageNum}.-`;
            }

            const cellsHtml = row.cells.map(c => `<td>${escapeHtml(c)}</td>`).join('');
            tbodyRows += `<tr${rowClass}><td class="fc">${label}</td>${cellsHtml}</tr>`;
        }

        tablesHtml += `
        <div class="page">
            <div class="page-title">${escapeHtml(sheet.name)} — ページ ${pageNum}</div>
            <table>${thead}<tbody>${tbodyRows}</tbody></table>
        </div>`;
    }

    // 印刷コンテナに挿入して window.print()
    let container = document.getElementById('print-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'print-container';
        document.body.appendChild(container);
    }
    container.innerHTML = tablesHtml;

    window.print();
}
