/**
 * Auto-update functionality
 * Handles update checking, installation, and user preferences
 */

// LocalStorage keys
const UPDATE_STORAGE_KEY = 'update-settings';
const LAST_LAUNCHED_VERSION_KEY = 'ditis-last-launched-version';

/**
 * アップデート後の初回起動を検出して通知する
 */
function checkJustUpdated() {
    const currentVersion = window.DITIS_VERSION || '';
    const currentBuild = window.DITIS_BUILD != null ? String(window.DITIS_BUILD) : '';
    const currentKey = `${currentVersion}+${currentBuild}`;

    const lastKey = localStorage.getItem(LAST_LAUNCHED_VERSION_KEY);

    if (lastKey && lastKey !== currentKey) {
        // バージョンが変わっていた = アップデート後初回起動
        const i18n = window.i18n || { t: (key) => key };
        const msg = i18n.t('updater.justUpdated')
            .replace('{0}', currentVersion)
            .replace('{1}', currentBuild);
        // 少し遅らせてUIが準備できてから通知
        setTimeout(() => {
            showErrorToast(msg, ErrorLevel.INFO, 5000);
        }, 1500);
    }

    // 今回のバージョンを記録
    localStorage.setItem(LAST_LAUNCHED_VERSION_KEY, currentKey);
}

/**
 * Get update settings from LocalStorage
 */
function getUpdateSettings() {
    const defaults = {
        autoCheckUpdates: true,
        lastUpdateCheck: null,
        ignoredVersions: []
    };
    
    try {
        const stored = localStorage.getItem(UPDATE_STORAGE_KEY);
        if (stored) {
            return { ...defaults, ...JSON.parse(stored) };
        }
    } catch (e) {
        console.error('Failed to load update settings:', e);
    }
    
    return defaults;
}

/**
 * Save update settings to LocalStorage
 */
function saveUpdateSettings(settings) {
    try {
        localStorage.setItem(UPDATE_STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
        console.error('Failed to save update settings:', e);
    }
}

/**
 * Check if we should check for updates (1 day limit)
 */
function shouldCheckUpdate(forceCheck = false) {
    if (forceCheck) return true;
    
    const settings = getUpdateSettings();
    if (!settings.autoCheckUpdates) return false;
    
    if (!settings.lastUpdateCheck) return true;
    
    const lastCheck = new Date(settings.lastUpdateCheck);
    if (isNaN(lastCheck.getTime())) {
        return true;
    }
    const now = new Date();
    const hoursSinceLastCheck = (now - lastCheck) / (1000 * 60 * 60);
    
    return hoursSinceLastCheck >= 24;
}

/**
 * Save last check timestamp
 */
function saveLastCheckTime() {
    const settings = getUpdateSettings();
    settings.lastUpdateCheck = new Date().toISOString();
    saveUpdateSettings(settings);
}

/**
 * Get ignored versions list
 */
function getIgnoredVersions() {
    const settings = getUpdateSettings();
    return settings.ignoredVersions || [];
}

/**
 * Add version to ignore list
 */
function addIgnoredVersion(version) {
    const settings = getUpdateSettings();
    if (!settings.ignoredVersions.includes(version)) {
        settings.ignoredVersions.push(version);
        saveUpdateSettings(settings);
    }
}

/**
 * Check for updates
 * @param {boolean} forceCheck - Force check even if within 24h limit
 * @returns {Promise<Object|null>} Update info or null
 */
async function checkForUpdates(forceCheck = false) {
    if (!shouldCheckUpdate(forceCheck)) {
        console.log('[Updater] Skipping update check (within 24h limit)');
        return null;
    }
    
    try {
        console.log('[Updater] Checking for updates...');
        
        // Call Tauri command
        const updateInfo = await window.__TAURI__.core.invoke('check_for_updates');
        
        saveLastCheckTime();
        
        if (!updateInfo.available) {
            console.log('[Updater] No updates available');
            return null;
        }
        
        // Check if this version is ignored
        const ignoredVersions = getIgnoredVersions();
        if (ignoredVersions.includes(updateInfo.version)) {
            console.log(`[Updater] Version ${updateInfo.version} is ignored`);
            return null;
        }
        
        console.log(`[Updater] Update available: ${updateInfo.version}`);
        return updateInfo;
        
    } catch (error) {
        console.error('[Updater] Failed to check for updates:', error);
        
        // Only show error if manual check
        if (forceCheck) {
            const errorMsg = error.toString().includes('Could not fetch')
                ? (window.i18n ? window.i18n.t('updater.noRelease') : 'リリースが見つかりません。このアプリはまだ公開リリースがない可能性があります。')
                : (window.i18n ? window.i18n.t('updater.checkFailed') : '更新の確認に失敗しました');
            
            showErrorToast(errorMsg, ErrorLevel.WARNING);
        }
        
        return false; // false = error (null = no update available)
    }
}

/**
 * Install update
 * @returns {Promise<boolean>} Success status
 */
async function installUpdate() {
    try {
        console.log('[Updater] Installing update...');
        
        await window.__TAURI__.core.invoke('install_update');
        
        console.log('[Updater] Update installed successfully');
        return true;
        
    } catch (error) {
        console.error('[Updater] Failed to install update:', error);
        
        showErrorToast(
            window.i18n ? window.i18n.t('updater.installFailed') : 'Failed to install update',
            ErrorLevel.ERROR
        );
        
        return false;
    }
}

/**
 * Get current app version
 */
async function getCurrentVersion() {
    try {
        return await window.__TAURI__.core.invoke('get_current_version');
    } catch (error) {
        console.error('[Updater] Failed to get current version:', error);
        return 'unknown';
    }
}

/**
 * Toggle auto-check setting
 */
function toggleAutoCheckUpdates(enabled) {
    const settings = getUpdateSettings();
    settings.autoCheckUpdates = enabled;
    saveUpdateSettings(settings);
    console.log(`[Updater] Auto-check updates: ${enabled ? 'ON' : 'OFF'}`);
}

/**
 * Check for updates on startup (if enabled)
 */
async function checkUpdatesOnStartup() {
    const settings = getUpdateSettings();
    
    if (!settings.autoCheckUpdates) {
        console.log('[Updater] Auto-check is disabled');
        return;
    }
    
    const updateInfo = await checkForUpdates(false);
    
    if (updateInfo) {
        const currentVersion = await getCurrentVersion();
        
        // Show update dialog
        showUpdateDialog(currentVersion, updateInfo);
    }
}

// Export functions
window.UpdaterAPI = {
    checkForUpdates,
    installUpdate,
    getCurrentVersion,
    toggleAutoCheckUpdates,
    addIgnoredVersion,
    getUpdateSettings,
    checkUpdatesOnStartup,
    checkJustUpdated
};
