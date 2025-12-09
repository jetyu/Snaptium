import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { autoUpdater } = require("electron-updater");

function createAutoUpdaterManager({ app, dialog, shell, t, getWindow, releasePageUrl, currentVersion }) {
  let isCheckingForUpdates = false;
  let isDownloadingUpdate = false;
  let autoUpdaterInitialized = false;
  let autoUpdateIntervalId = null;
  let isBackgroundCheck = false;
  const AUTO_UPDATE_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours in milliseconds

  function getActiveWindow() {
    if (typeof getWindow !== "function") {
      return null;
    }
    const win = getWindow();
    if (!win || win.isDestroyed()) {
      return null;
    }
    return win;
  }

  function setProgress(value) {
    const win = getActiveWindow();
    if (win) {
      win.setProgressBar(value);
    }
  }

  function setIndeterminateProgress() {
    setProgress(2);
  }

  function resetProgress() {
    setProgress(-1);
  }

  function formatReleaseNotes(info) {
    if (!info) {
      return null;
    }

    const pieces = [];
    if (info.version) {
      pieces.push(`${t("update.detail.newVersion")}: ${info.version}`);
    }
    if (currentVersion) {
      pieces.push(`${t("update.detail.currentVersion")}: ${currentVersion}`);
    }
    if (releasePageUrl) {
      pieces.push(`${t("update.detail.viewChangelog")}: ${releasePageUrl}/latest`);
    }
    return pieces.length > 0 ? pieces.join("\n") : null;
  }

  function initialize() {
    if (autoUpdaterInitialized || !app.isPackaged) {
      return;
    }

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on("checking-for-update", () => {
      isCheckingForUpdates = true;
      setIndeterminateProgress();
    });

    autoUpdater.on("update-available", async (info) => {
      isCheckingForUpdates = false;
      resetProgress();

      const detail = formatReleaseNotes(info);
      const { response } = await dialog.showMessageBox(getActiveWindow() ?? undefined, {
        type: "info",
        buttons: [
          t("update.button.downloadNow"),
          t("update.button.later")
        ],
        defaultId: 0,
        cancelId: 1,
        title: t("appName"),
        message: t("update.message.available"),
        detail: detail ?? undefined,
        noLink: false,
      });

      if (response === 0) {
        isDownloadingUpdate = true;
        setProgress(0);
        try {
          await autoUpdater.downloadUpdate();
        } catch (error) {
          isDownloadingUpdate = false;
          resetProgress();
          dialog.showErrorBox(
            t("update.error.downloadFailed"),
            error instanceof Error ? error.message : String(error)
          );
        }
      }
    });

    autoUpdater.on("update-not-available", async () => {
      isCheckingForUpdates = false;
      resetProgress();
      // Only show dialog for manual checks, not background checks
      if (!isBackgroundCheck) {
        await dialog.showMessageBox(getActiveWindow() ?? undefined, {
          type: "info",
          buttons: [t("update.button.confirm")],
          defaultId: 0,
          title: t("appName"),
          message: t("update.message.latest"),
          noLink: true,
        });
      }
      isBackgroundCheck = false;
    });

    autoUpdater.on("error", (error) => {
      isCheckingForUpdates = false;
      isDownloadingUpdate = false;
      resetProgress();
      // Only show error dialog for manual checks, silently fail for background checks
      if (!isBackgroundCheck) {
        dialog.showErrorBox(
          t("update.error.generic"),
          error instanceof Error ? error.message : String(error)
        );
      } else {
        console.error("[Auto-Update] Background check failed:", error);
      }
      isBackgroundCheck = false;
    });

    autoUpdater.on("download-progress", (progress) => {
      if (!progress || typeof progress.percent !== "number") {
        return;
      }
      const value = Math.max(0, Math.min(progress.percent / 100, 1));
      setProgress(value);
    });

    autoUpdater.on("update-downloaded", async () => {
      isDownloadingUpdate = false;
      resetProgress();
      const { response } = await dialog.showMessageBox(getActiveWindow() ?? undefined, {
        type: "question",
        buttons: [t("update.button.restartNow"), t("update.button.remindLater")],
        defaultId: 0,
        cancelId: 1,
        title: t("appName"),
        message: t("update.message.downloaded"),
        noLink: true,
      });

      if (response === 0) {
        autoUpdater.quitAndInstall();
      }
    });

    autoUpdaterInitialized = true;
  }

  async function checkForUpdates() {
    if (!app.isPackaged) {
      const { response } = await dialog.showMessageBox(getActiveWindow() ?? undefined, {
        type: "info",
        buttons: [t("update.button.openReleasePage"), t("update.button.cancel")],
        defaultId: 0,
        cancelId: 1,
        title: t("appName"),
        message: t("update.devMode.message"),
        detail: t("update.devMode.detail"),
        noLink: true,
      });
      if (response === 0 && releasePageUrl) {
        shell.openExternal(releasePageUrl);
      }
      return;
    }

    initialize();

    if (isCheckingForUpdates) {
      await dialog.showMessageBox(getActiveWindow() ?? undefined, {
        type: "info",
        buttons: [t("update.button.confirm")],
        defaultId: 0,
        title: t("appName"),
        message: t("update.message.inProgress"),
        noLink: true,
      });
      return;
    }

    if (isDownloadingUpdate) {
      await dialog.showMessageBox(getActiveWindow() ?? undefined, {
        type: "info",
        buttons: [t("update.button.confirm")],
        defaultId: 0,
        title: t("appName"),
        message: t("update.message.downloading"),
        noLink: true,
      });
      return;
    }

    try {
      isCheckingForUpdates = true;
      setIndeterminateProgress();
      await autoUpdater.checkForUpdates();
    } catch (error) {
      isCheckingForUpdates = false;
      resetProgress();
      dialog.showErrorBox(
        t("update.error.checkFailed"),
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async function checkForUpdatesInBackground() {
    if (!app.isPackaged) {
      return;
    }

    initialize();

    if (isCheckingForUpdates || isDownloadingUpdate) {
      return;
    }

    try {
      isBackgroundCheck = true;
      isCheckingForUpdates = true;
      await autoUpdater.checkForUpdates();
    } catch (error) {
      isCheckingForUpdates = false;
      isBackgroundCheck = false;
      console.error("[Auto-Update] Background check failed:", error);
    }
  }

  function startAutoUpdateCheck() {
    if (autoUpdateIntervalId) {
      console.log("[Auto-Update] Auto-update check already running");
      return;
    }

    console.log("[Auto-Update] Starting auto-update check with interval:", AUTO_UPDATE_INTERVAL / 1000 / 60, "minutes");

    // Perform initial check after 5 minutes
    setTimeout(() => {
      checkForUpdatesInBackground();
    }, 5 * 60 * 1000);

    // Set up periodic checks
    autoUpdateIntervalId = setInterval(() => {
      checkForUpdatesInBackground();
    }, AUTO_UPDATE_INTERVAL);
  }

  function stopAutoUpdateCheck() {
    if (autoUpdateIntervalId) {
      console.log("[Auto-Update] Stopping auto-update check");
      clearInterval(autoUpdateIntervalId);
      autoUpdateIntervalId = null;
    }
  }

  return {
    initialize,
    checkForUpdates,
    checkForUpdatesInBackground,
    startAutoUpdateCheck,
    stopAutoUpdateCheck,
  };
}

export { createAutoUpdaterManager };
