// ========================================
// カスタムダイアログシステム
// ========================================

/**
 * カスタムダイアログを表示
 * @param {Object} options - ダイアログオプション
 * @param {string} options.title - ダイアログタイトル
 * @param {string} options.content - HTMLコンテンツ
 * @param {string} options.okText - OKボタンテキスト（デフォルト: 'OK'）
 * @param {string} options.cancelText - キャンセルボタンテキスト（デフォルト: 'キャンセル'）
 * @param {Function} options.onOk - OKボタン押下時のコールバック（戻り値がfalseならダイアログを閉じない）
 * @param {Function} options.onCancel - キャンセルボタン押下時のコールバック
 * @param {Function} options.onShow - ダイアログ表示時のコールバック
 * @param {boolean} options.hideCancel - キャンセルボタンを非表示にする
 */
function showDialog(options) {
    const overlay = document.getElementById('custom-dialog-overlay');
    const dialog = document.getElementById('custom-dialog');
    const titleEl = document.getElementById('dialog-title');
    const contentEl = document.getElementById('dialog-content');
    const okBtn = document.getElementById('dialog-ok-btn');
    const cancelBtn = document.getElementById('dialog-cancel-btn');
    const extraBtn = document.getElementById('dialog-extra-btn');
    const closeBtn = document.getElementById('dialog-close-btn');
    
    titleEl.textContent = options.title || 'ダイアログ';
    contentEl.innerHTML = options.content || '';
    okBtn.textContent = options.okText || 'OK';
    cancelBtn.textContent = options.cancelText || 'キャンセル';
    
    if (options.hideCancel) {
        cancelBtn.style.display = 'none';
    } else {
        cancelBtn.style.display = '';
    }

    if (options.extraText) {
        extraBtn.textContent = options.extraText;
        extraBtn.style.display = '';
    } else {
        extraBtn.style.display = 'none';
    }
    
    let handleKeydown;
    
    const closeDialog = () => {
        overlay.style.display = 'none';
        okBtn.onclick = null;
        cancelBtn.onclick = null;
        extraBtn.onclick = null;
        closeBtn.onclick = null;
        if (handleKeydown) {
            document.removeEventListener('keydown', handleKeydown);
        }
    };
    
    okBtn.onclick = async () => {
        if (options.onOk) {
            const result = await options.onOk();
            if (result !== false) {
                closeDialog();
            }
        } else {
            closeDialog();
        }
    };
    
    cancelBtn.onclick = () => {
        if (options.onCancel) {
            options.onCancel();
        }
        closeDialog();
    };

    extraBtn.onclick = () => {
        if (options.onExtra) {
            options.onExtra();
        }
        closeDialog();
    };
    
    closeBtn.onclick = () => {
        if (options.onCancel) {
            options.onCancel();
        }
        closeDialog();
    };
    
    // ESCキーで閉じる
    handleKeydown = (e) => {
        if (e.key === 'Escape') {
            if (options.onCancel) {
                options.onCancel();
            }
            closeDialog();
        } else if (e.key === 'Enter' && !e.shiftKey) {
            const activeElement = document.activeElement;
            if (activeElement.tagName !== 'TEXTAREA') {
                e.preventDefault();
                okBtn.click();
            }
        }
    };
    document.addEventListener('keydown', handleKeydown);
    
    overlay.style.display = 'flex';
    
    // 全ての入力フィールドをフォーカス時に選択状態にする
    contentEl.querySelectorAll('input').forEach(input => {
        input.addEventListener('focus', () => input.select());
    });
    
    if (options.onShow) {
        options.onShow();
    }
    
    // 最初の入力フィールドにフォーカス
    const firstInput = contentEl.querySelector('input, select');
    if (firstInput) {
        setTimeout(() => {
            firstInput.focus();
            if (firstInput.tagName === 'INPUT') {
                firstInput.select();
            }
        }, 50);
    }
}

/**
 * 簡易入力ダイアログ（prompt代替）
 * @param {string} title - タイトル
 * @param {string} label - ラベル
 * @param {string} defaultValue - デフォルト値
 * @param {string} hint - ヒントテキスト（オプション）
 * @returns {Promise<string|null>} - 入力値またはnull（キャンセル時）
 */
function showInputDialog(title, label, defaultValue = '', hint = '') {
    return new Promise((resolve) => {
        const hintHtml = hint ? `<div class="dialog-hint">${escapeHtml(hint)}</div>` : '';
        showDialog({
            title: title,
            content: `
                <div class="dialog-field">
                    <label class="dialog-label">${escapeHtml(label)}</label>
                    <input type="text" id="dialog-input-value" class="dialog-input" value="${escapeHtml(defaultValue)}" autocomplete="off">
                    ${hintHtml}
                </div>
            `,
            onOk: () => {
                const value = document.getElementById('dialog-input-value').value;
                resolve(value);
            },
            onCancel: () => {
                resolve(null);
            },
            onShow: () => {
                const input = document.getElementById('dialog-input-value');
                input.select();
            }
        });
    });
}

/**
 * シート設定ダイアログを表示
 * @param {Object} options - オプション
 * @param {string} options.mode - 'new'（新規作成）または 'edit'（編集）
 * @param {Object} options.sheet - 編集時のシート情報
 * @returns {Promise<Object|null>} - シート設定またはnull（キャンセル時）
 */
function showSheetSettingsDialog(options = {}) {
    const mode = options.mode || 'edit';
    const sheet = options.sheet || getCurrentSheet();
    const isNew = mode === 'new';
    
    const title = isNew ? '新規シート作成' : 'シート設定';
    const okText = isNew ? '作成' : '適用';
    
    // デフォルト値
    const defaultName = isNew ? `Sheet${AppState.sheets.length + 1}` : sheet.name;
    const defaultFps = AppState.fps;
    const defaultFrames = isNew ? 144 : sheet.frames;
    const defaultColumns = isNew ? 12 : sheet.layers.length;
    const defaultFramePageSize = isNew ? 144 : (sheet.framePageSize || 144);
    
    // 秒+コマ形式に変換
    const totalSeconds = Math.floor(defaultFrames / defaultFps);
    const remainingFrames = defaultFrames % defaultFps;
    
    return new Promise((resolve) => {
        showDialog({
            title: title,
            content: `
                <div class="dialog-field">
                    <label class="dialog-label">シート名</label>
                    <input type="text" id="dialog-sheet-name" class="dialog-input" value="${escapeHtml(defaultName)}" autocomplete="off">
                </div>
                <div class="dialog-row">
                    <div class="dialog-field">
                        <label class="dialog-label">フレームレート</label>
                        <input type="number" id="dialog-fps" class="dialog-input" value="${defaultFps}" min="1" max="120" step="1" style="width:70px;">
                        <span style="margin-left:4px;">fps</span>
                    </div>
                    <div class="dialog-field">
                        <label class="dialog-label">列数</label>
                        <input type="number" id="dialog-columns" class="dialog-input" value="${defaultColumns}" min="1" max="26">
                    </div>
                </div>
                <div class="dialog-row">
                    <div class="dialog-field">
                        <label class="dialog-label">秒数</label>
                        <input type="number" id="dialog-seconds" class="dialog-input" value="${totalSeconds}" min="0">
                    </div>
                    <div class="dialog-field">
                        <label class="dialog-label">+コマ</label>
                        <input type="number" id="dialog-extra-frames" class="dialog-input" value="${remainingFrames}" min="0">
                    </div>
                </div>
                <div class="dialog-field">
                    <label class="dialog-label">1ページあたりのコマ数</label>
                    <input type="number" id="dialog-frame-page" class="dialog-input" value="${defaultFramePageSize}" min="1">
                    <div class="dialog-hint">合計：<span id="dialog-frame-page-total">${defaultFrames}</span>コマ（<span id="dialog-total-sec">${Math.floor(defaultFrames / defaultFps)}</span>秒+<span id="dialog-total-koma">${defaultFrames % defaultFps}</span>コマ）</div>
                </div>
            `,
            okText: okText,
            onOk: () => {
                const name = document.getElementById('dialog-sheet-name').value.trim();
                const fps = parseInt(document.getElementById('dialog-fps').value);
                const columns = parseInt(document.getElementById('dialog-columns').value);
                const seconds = parseInt(document.getElementById('dialog-seconds').value) || 0;
                const extraFrames = parseInt(document.getElementById('dialog-extra-frames').value) || 0;
                const totalFrames = seconds * fps + extraFrames;
                const framePageSize = parseInt(document.getElementById('dialog-frame-page').value) || 144;
                
                if (!name) {
                    showErrorToast('シート名を入力してください', ErrorLevel.WARNING);
                    return false;
                }
                if (totalFrames < 1) {
                    showErrorToast('フレーム数は1以上にしてください', ErrorLevel.WARNING);
                    return false;
                }
                if (columns < 1 || columns > 26) {
                    showErrorToast('列数は1〜26の範囲で入力してください', ErrorLevel.WARNING);
                    return false;
                }
                
                resolve({
                    name: name,
                    fps: fps,
                    frames: totalFrames,
                    columns: columns,
                    framePageSize: framePageSize
                });
            },
            onCancel: () => {
                resolve(null);
            },
            onShow: () => {
                // フレーム数の自動計算
                const updateTotal = () => {
                    const fps = parseInt(document.getElementById('dialog-fps').value);
                    const seconds = parseInt(document.getElementById('dialog-seconds').value) || 0;
                    const extra = parseInt(document.getElementById('dialog-extra-frames').value) || 0;
                    const total = seconds * fps + extra;
                    document.getElementById('dialog-frame-page-total').textContent = total;
                    document.getElementById('dialog-total-sec').textContent = Math.floor(total / fps);
                    document.getElementById('dialog-total-koma').textContent = total % fps;
                };
                
                document.getElementById('dialog-fps').addEventListener('change', updateTotal);
                document.getElementById('dialog-seconds').addEventListener('input', updateTotal);
                document.getElementById('dialog-extra-frames').addEventListener('input', updateTotal);
            }
        });
    });
}

/**
 * FPS変更ダイアログを表示
 * @returns {Promise<number|null>} - 新しいFPS値またはnull
 */
function showFpsDialog() {
    return new Promise((resolve) => {
        showDialog({
            title: 'フレームレートを変更',
            content: `
                <div class="dialog-field">
                    <label class="dialog-label">フレームレート</label>
                    <input type="number" id="dialog-fps-value" class="dialog-input" value="${AppState.fps}" min="1" max="120" step="1" style="width:80px;">
                    <span style="margin-left:6px;">fps</span>
                    <div class="dialog-hint">現在: ${AppState.fps} fps（1〜120の整数）</div>
                </div>
            `,
            onOk: () => {
                const value = parseInt(document.getElementById('dialog-fps-value').value);
                resolve(isNaN(value) ? null : value);
            },
            onCancel: () => {
                resolve(null);
            }
        });
    });
}

/**
 * 尺変更ダイアログを表示
 * @returns {Promise<number|null>} - 新しいフレーム数またはnull
 */
function showDurationDialog() {
    const sheet = getCurrentSheet();
    const currentFrames = sheet.frames;
    const fps = AppState.fps;
    const currentSeconds = Math.floor(currentFrames / fps);
    const currentExtra = currentFrames % fps;
    
    return new Promise((resolve) => {
        showDialog({
            title: '尺を変更',
            content: `
                <div class="dialog-row">
                    <div class="dialog-field">
                        <label class="dialog-label">秒数</label>
                        <input type="number" id="dialog-dur-seconds" class="dialog-input" value="${currentSeconds}" min="0">
                    </div>
                    <div class="dialog-field">
                        <label class="dialog-label">+コマ</label>
                        <input type="number" id="dialog-dur-extra" class="dialog-input" value="${currentExtra}" min="0">
                    </div>
                </div>
                <div class="dialog-hint">現在: ${currentFrames} フレーム (${currentSeconds}秒+${currentExtra}コマ) → <span id="dialog-dur-total">${currentFrames}</span> フレーム (<span id="dialog-dur-sec">${currentSeconds}</span>秒+<span id="dialog-dur-koma">${currentExtra}</span>コマ)</div>
            `,
            onOk: () => {
                const seconds = parseInt(document.getElementById('dialog-dur-seconds').value) || 0;
                const extra = parseInt(document.getElementById('dialog-dur-extra').value) || 0;
                const total = seconds * fps + extra;
                if (total < 1) {
                    alert('フレーム数は1以上にしてください');
                    return false;
                }
                resolve(total);
            },
            onCancel: () => {
                resolve(null);
            },
            onShow: () => {
                const updateTotal = () => {
                    const seconds = parseInt(document.getElementById('dialog-dur-seconds').value) || 0;
                    const extra = parseInt(document.getElementById('dialog-dur-extra').value) || 0;
                    const total = seconds * fps + extra;
                    document.getElementById('dialog-dur-total').textContent = total;
                    document.getElementById('dialog-dur-sec').textContent = Math.floor(total / fps);
                    document.getElementById('dialog-dur-koma').textContent = total % fps;
                };
                document.getElementById('dialog-dur-seconds').addEventListener('input', updateTotal);
                document.getElementById('dialog-dur-extra').addEventListener('input', updateTotal);
            }
        });
    });
}

/**
 * 列数変更ダイアログを表示
 * @returns {Promise<number|null>} - 新しい列数またはnull
 */
function showColumnsDialog() {
    const sheet = getCurrentSheet();
    const currentColumns = sheet.layers.length;
    
    return new Promise((resolve) => {
        showDialog({
            title: '列数を変更',
            content: `
                <div class="dialog-field">
                    <label class="dialog-label">列数</label>
                    <input type="number" id="dialog-columns-value" class="dialog-input" value="${currentColumns}" min="1" max="26">
                    <div class="dialog-hint">現在: ${currentColumns} 列 → <span id="dialog-col-new">${currentColumns}</span> 列</div>
                </div>
            `,
            onOk: () => {
                const value = parseInt(document.getElementById('dialog-columns-value').value);
                if (isNaN(value) || value < 1 || value > 26) {
                    alert('列数は1〜26の範囲で入力してください');
                    return false;
                }
                resolve(value);
            },
            onCancel: () => {
                resolve(null);
            },
            onShow: () => {
                const input = document.getElementById('dialog-columns-value');
                input.select();
                input.addEventListener('input', () => {
                    document.getElementById('dialog-col-new').textContent = parseInt(input.value) || 0;
                });
            }
        });
    });
}

/**
 * フレームページ変更ダイアログを表示
 * @returns {Promise<number|null>} - 新しいフレーム数またはnull
 */
function showFramePageDialog() {
    const sheet = getCurrentSheet();
    const currentPageSize = sheet.framePageSize || 144;
    const fps = AppState.fps;
    
    return new Promise((resolve) => {
        showDialog({
            title: '1ページあたりのコマ数を変更',
            content: `
                <div class="dialog-field">
                    <label class="dialog-label">1ページあたりのコマ数</label>
                    <input type="number" id="dialog-frame-page-value" class="dialog-input" value="${currentPageSize}" min="1">
                    <div class="dialog-hint">合計：${sheet.frames}コマ</div>
                </div>
            `,
            onOk: () => {
                const value = parseInt(document.getElementById('dialog-frame-page-value').value);
                if (isNaN(value) || value < 1) {
                    showErrorToast('コマ数は1以上にしてください', ErrorLevel.WARNING);
                    return false;
                }
                resolve(value);
            },
            onCancel: () => {
                resolve(null);
            },
            onShow: () => {
                const input = document.getElementById('dialog-frame-page-value');
                input.select();
            }
        });
    });
}

/**
 * シート名変更ダイアログを表示
 * @param {string} currentName - 現在のシート名
 * @returns {Promise<string|null>} - 新しいシート名またはnull
 */
function showRenameSheetDialog(currentName) {
    return showInputDialog('シート名を変更', 'シート名', currentName);
}

/**
 * レイヤー名変更ダイアログを表示
 * @param {string} currentName - 現在のレイヤー名
 * @returns {Promise<string|null>} - 新しいレイヤー名またはnull
 */
function showRenameLayerDialog(currentName) {
    return showInputDialog('レイヤー名を変更', 'レイヤー名', currentName);
}

/**
 * フレーム挿入ダイアログを表示
 * @param {number} position - 挿入位置（フレーム番号）
 * @param {boolean} isHead - 先頭挿入か
 * @param {boolean} isEnd - 末尾追加か
 * @returns {Promise<number|null>} - 挿入フレーム数またはnull
 */
function showInsertFramesDialog(position = 1, isHead = false, isEnd = false) {
    const sheet = getCurrentSheet();
    const currentFrames = sheet.frames;
    const fps = AppState.fps;
    
    let title;
    if (isHead) {
        title = '先頭にフレームを挿入';
    } else if (isEnd) {
        title = '末尾にフレームを追加';
    } else {
        title = `フレーム ${position} にフレームを挿入`;
    }
    
    return new Promise((resolve) => {
        showDialog({
            title: title,
            content: `
                <div class="dialog-field">
                    <label class="dialog-label">${isEnd ? '追加' : '挿入'}するフレーム数</label>
                    <input type="number" id="dialog-insert-count" class="dialog-input" value="12" min="1">
                    <div class="dialog-hint">現在: ${currentFrames} フレーム (${Math.floor(currentFrames / fps)}秒+${currentFrames % fps}コマ) → <span id="dialog-ins-total">${currentFrames + 12}</span> フレーム (<span id="dialog-ins-sec">${Math.floor((currentFrames + 12) / fps)}</span>秒+<span id="dialog-ins-koma">${(currentFrames + 12) % fps}</span>コマ)</div>
                </div>
            `,
            onOk: () => {
                const count = parseInt(document.getElementById('dialog-insert-count').value);
                if (isNaN(count) || count < 1) {
                    showErrorToast('フレーム数は1以上にしてください', ErrorLevel.WARNING);
                    return false;
                }
                resolve(count);
            },
            onCancel: () => {
                resolve(null);
            },
            onShow: () => {
                const input = document.getElementById('dialog-insert-count');
                input.select();
                input.addEventListener('input', () => {
                    const count = parseInt(input.value) || 0;
                    const total = currentFrames + count;
                    document.getElementById('dialog-ins-total').textContent = total;
                    document.getElementById('dialog-ins-sec').textContent = Math.floor(total / fps);
                    document.getElementById('dialog-ins-koma').textContent = total % fps;
                });
            }
        });
    });
}

/**
 * 位置指定フレーム挿入ダイアログを表示
 * @returns {Promise<{position: number, count: number}|null>}
 */
function showInsertFramesAtPositionDialog() {
    const sheet = getCurrentSheet();
    const currentFrames = sheet.frames;
    const fps = AppState.fps;
    
    return new Promise((resolve) => {
        showDialog({
            title: 'フレームを挿入',
            content: `
                <div class="dialog-field">
                    <label class="dialog-label">挿入位置（フレーム番号）</label>
                    <input type="number" id="dialog-insert-position" class="dialog-input" value="1" min="1">
                </div>
                <div class="dialog-field">
                    <label class="dialog-label">挿入するフレーム数</label>
                    <input type="number" id="dialog-insert-count" class="dialog-input" value="12" min="1">
                    <div class="dialog-hint">現在: ${currentFrames} フレーム (${Math.floor(currentFrames / fps)}秒+${currentFrames % fps}コマ) → <span id="dialog-insp-total">${currentFrames + 12}</span> フレーム (<span id="dialog-insp-sec">${Math.floor((currentFrames + 12) / fps)}</span>秒+<span id="dialog-insp-koma">${(currentFrames + 12) % fps}</span>コマ)</div>
                </div>
            `,
            onOk: () => {
                const position = parseInt(document.getElementById('dialog-insert-position').value);
                const count = parseInt(document.getElementById('dialog-insert-count').value);
                if (isNaN(position) || position < 1) {
                    showErrorToast('挿入位置は1以上にしてください', ErrorLevel.WARNING);
                    return false;
                }
                if (isNaN(count) || count < 1) {
                    showErrorToast('フレーム数は1以上にしてください', ErrorLevel.WARNING);
                    return false;
                }
                resolve({ position: position, count: count });
            },
            onCancel: () => {
                resolve(null);
            },
            onShow: () => {
                document.getElementById('dialog-insert-position').select();
                document.getElementById('dialog-insert-count').addEventListener('input', () => {
                    const count = parseInt(document.getElementById('dialog-insert-count').value) || 0;
                    const total = currentFrames + count;
                    document.getElementById('dialog-insp-total').textContent = total;
                    document.getElementById('dialog-insp-sec').textContent = Math.floor(total / fps);
                    document.getElementById('dialog-insp-koma').textContent = total % fps;
                });
            }
        });
    });
}

/**
 * フレームシフトダイアログを表示
 * @param {number} startFrame - シフト開始フレーム
 * @param {number} maxRows - 最大行数
 * @returns {Promise<number|null>} - シフト量またはnull
 */
function showShiftFramesDialog(startFrame, maxRows) {
    return new Promise((resolve) => {
        showDialog({
            title: 'フレームをシフト',
            content: `
                <div class="dialog-field">
                    <label class="dialog-label">シフト量</label>
                    <input type="number" id="dialog-shift-amount" class="dialog-input" value="1">
                    <div class="dialog-hint">正の数: 下へ移動、負の数: 上へ移動</div>
                    <div class="dialog-hint">フレーム ${startFrame} から開始</div>
                </div>
            `,
            onOk: () => {
                const value = parseInt(document.getElementById('dialog-shift-amount').value);
                if (isNaN(value) || value === 0) {
                    showErrorToast('0以外の数値を入力してください', ErrorLevel.WARNING);
                    return false;
                }
                // 範囲チェック
                if (value > 0 && startFrame + value > maxRows) {
                    showErrorToast(`シフト量が大きすぎます。最大${maxRows - startFrame}コマまでシフトできます。`, ErrorLevel.WARNING);
                    return false;
                }
                if (value < 0 && startFrame + value < 1) {
                    showErrorToast(`シフト量が大きすぎます。最大${startFrame - 1}コマまで上にシフトできます。`, ErrorLevel.WARNING);
                    return false;
                }
                resolve(value);
            },
            onCancel: () => {
                resolve(null);
            },
            onShow: () => {
                document.getElementById('dialog-shift-amount').select();
            }
        });
    });
}

/**
 * 更新確認ダイアログを表示
 * @param {string} currentVersion - 現在のバージョン
 * @param {Object} updateInfo - 更新情報
 * @param {string} updateInfo.version - 新バージョン
 * @param {string} updateInfo.date - リリース日
 * @param {string} updateInfo.body - リリースノート
 */
async function showUpdateDialog(currentVersion, updateInfo) {
    const i18n = window.i18n || { t: (key) => key };
    
    // 外部データをエスケープ
    const safeVersion = escapeHtml(updateInfo.version || '');
    const safeDate = escapeHtml(updateInfo.date || '');
    const safeCurrentVersion = escapeHtml(currentVersion || '');
    
    const content = `
        <div style="display: flex; align-items: start; gap: 20px; margin: 10px 0;">
            <div style="flex: 1;">
                <p style="margin: 0 0 10px 0; font-size: 14px; line-height: 1.6;">
                    <strong>DiTiS v${safeVersion}</strong> ${i18n.t('updater.available')}<br>
                    ${i18n.t('updater.currentVersion')}: <strong>v${safeCurrentVersion}</strong>
                </p>
                ${safeDate ? `<p style="margin: 0 0 10px 0; font-size: 12px; color: #666;">${i18n.t('updater.releaseDate')}: ${safeDate}</p>` : ''}
                <p style="margin: 10px 0 0 0; font-size: 13px;">
                    ${i18n.t('updater.downloadPrompt')}
                </p>
            </div>
        </div>
    `;
    
    showDialog({
        title: i18n.t('updater.title'),
        content: content,
        okText: i18n.t('updater.downloadNow'),
        cancelText: i18n.t('updater.remindLater'),
        extraText: i18n.t('updater.ignoreVersion'),
        onOk: async () => {
            // ダウンロード中はボタンを無効化
            const okBtn = document.getElementById('dialog-ok-btn');
            const cancelBtn = document.getElementById('dialog-cancel-btn');
            const extraBtn = document.getElementById('dialog-extra-btn');
            if (okBtn) { okBtn.disabled = true; okBtn.textContent = i18n.t('updater.checking'); }
            if (cancelBtn) cancelBtn.disabled = true;
            if (extraBtn) extraBtn.disabled = true;

            const success = await window.UpdaterAPI.installUpdate();

            // ダイアログを閉じてから再起動ダイアログへ
            const overlay = document.getElementById('custom-dialog-overlay');
            if (overlay) overlay.style.display = 'none';

            if (success) {
                showErrorToast(i18n.t('updater.installSuccess'), ErrorLevel.INFO);
                showDialog({
                    title: i18n.t('updater.restartTitle'),
                    content: `<p>${i18n.t('updater.restartPrompt')}</p>`,
                    okText: i18n.t('updater.restartNow'),
                    cancelText: i18n.t('updater.restartLater'),
                    onOk: () => {
                        window.__TAURI__.process.relaunch();
                    }
                });
            }
            // onOkがPromiseを返すためcloseDialogが呼ばれないようfalseを返す
            return false;
        },
        onCancel: () => {
            // 「後でリマインド」→何もしない（次回起動時に再度表示）
        },
        onExtra: () => {
            // 「このバージョンを無視」
            window.UpdaterAPI.addIgnoredVersion(updateInfo.version);
            showErrorToast(i18n.t('updater.ignoreSuccess'), ErrorLevel.INFO);
        }
    });
}

