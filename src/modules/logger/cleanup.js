import * as fs from "node:fs";
import * as path from "node:path";
import { LOG_FILE_PREFIX, LOG_RETENTION_DAYS } from "./config.js";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function cleanupLogs({ logDir, retentionDays = LOG_RETENTION_DAYS, logger }) {
  if (!fs.existsSync(logDir)) return { removed: 0 };

  const files = fs.readdirSync(logDir);
  const now = Date.now();
  let removed = 0;

  for (const file of files) {
    if (!file.startsWith(`${LOG_FILE_PREFIX}_`) || !file.endsWith(".log")) {
      continue;
    }

    const fullPath = path.join(logDir, file);
    const stats = fs.statSync(fullPath);
    const ageInDays = (now - stats.mtimeMs) / ONE_DAY_MS;
    if (ageInDays > retentionDays) {
      fs.unlinkSync(fullPath);
      removed += 1;
      logger?.info?.(`[app] Removed outdated log file: ${file}`);
    }
  }

  return { removed };
}

export function scheduleLogCleanup({ logDir, logger, retentionDays = LOG_RETENTION_DAYS }) {
  const run = () => {
    try {
      const result = cleanupLogs({ logDir, logger, retentionDays });
      logger?.info?.(`[app] Log cleanup finished, removed ${result.removed} files`);
    } catch (error) {
      logger?.error?.("[app] Log cleanup failed:", error);
    }
  };

  run();
  const timer = setInterval(run, ONE_DAY_MS);
  return () => clearInterval(timer);
}
