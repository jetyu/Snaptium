export interface OpenFileResult {
  filePath: string;
  content: string;
}

export interface SaveFilePayload {
  filePath: string | null;
  content: string;
}

export interface SaveFileResult {
  filePath: string;
}

export interface LogPayload {
  level: string;
  source: string;
  message: string;
}

function ensureElectronApi() {
  if (!window.electronAPI) {
    throw new Error('electronAPI bridge is unavailable. Make sure preload is loaded.');
  }

  return window.electronAPI;
}

export async function openMarkdownFile(): Promise<OpenFileResult | null> {
  return ensureElectronApi().openFile();
}

export async function saveMarkdownFile(payload: SaveFilePayload): Promise<SaveFileResult | null> {
  return ensureElectronApi().saveFile(payload);
}

export function logToMain(payload: LogPayload): void {
  ensureElectronApi().log(payload);
}
