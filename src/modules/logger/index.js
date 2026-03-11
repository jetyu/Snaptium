import * as fs from "node:fs";
import * as path from "node:path";
import { createGlobalLogger } from "./logger.js";
import { createLogger } from "./createLogger.js";
import { cleanupLogs, scheduleLogCleanup } from "./cleanup.js";
import { registerExceptionHandlers } from "./exception.js";

export function createLoggerManager({ app, dialog, shell, AdmZip, appLoggerCategory = "LogManager-Box" }) {
  const { logger, logDir } = createGlobalLogger(app);
  const appLogger = createLogger(logger, appLoggerCategory);
  const stopCleanup = scheduleLogCleanup({ logDir, logger: appLogger });

  registerExceptionHandlers({ logger: appLogger, dialog });

  function openLogDirectory() {
    return shell.openPath(logDir);
  }

  async function exportLogs(parentWindow) {
    const defaultPath = path.join(app.getPath("documents"), `notewizard_logs_${Date.now()}.zip`);
    const { canceled, filePath } = await dialog.showSaveDialog(parentWindow, {
      title: "Export Logs",
      defaultPath,
      filters: [{ name: "Zip Archive", extensions: ["zip"] }]
    });

    if (canceled || !filePath) {
      return { success: false, cancelled: true };
    }

    const zip = new AdmZip();
    if (fs.existsSync(logDir)) {
      zip.addLocalFolder(logDir, "logs");
    }
    zip.writeZip(filePath);

    appLogger.info(`Logs exported to ${filePath}`);
    return { success: true, filePath };
  }

  function cleanupNow() {
    const result = cleanupLogs({ logDir, logger: appLogger });
    return result;
  }

  function destroy() {
    stopCleanup();
  }

  return {
    baseLogger: logger,
    appLogger,
    createLogger: (category) => createLogger(logger, category),
    getLogDirectory: () => logDir,
    openLogDirectory,
    exportLogs,
    cleanupNow,
    destroy
  };
}
