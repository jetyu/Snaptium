import * as path from "node:path";

export const LOG_FILE_PREFIX = "notewizard";
export const LOG_RETENTION_DAYS = 30;

function pad2(value) {
  return String(value).padStart(2, "0");
}

export function formatDateForFile(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function getLogDirectory(app) {
  return path.join(app.getPath("appData"), "NoteWizard", "logs");
}

export function getLogFileName(date = new Date()) {
  return `${LOG_FILE_PREFIX}_${formatDateForFile(date)}.log`;
}
