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

export interface AiCompletePayload {
  context: string;
}

export interface AiCompleteResult {
  success: boolean;
  completion?: string;
  message?: string;
}

function ensureElectronApi() {
  if (!window.electronAPI) {
    throw new Error('electronAPI bridge is unavailable. Make sure preload is loaded.');
  }

  return window.electronAPI;
}

export const electronApi = {
  openFile: async (): Promise<OpenFileResult | null> => {
    return ensureElectronApi().openFile();
  },

  saveFile: async (payload: SaveFilePayload): Promise<SaveFileResult | null> => {
    return ensureElectronApi().saveFile(payload);
  },

  logger: {
    log: (payload: LogPayload): void => {
      ensureElectronApi().logger.log(payload);
    },
  },

  aiAssistant: {
    complete: async (payload: AiCompletePayload): Promise<AiCompleteResult> => {
      const api = ensureElectronApi().aiAssistant;
      if (!api) {
        return { success: false, message: 'AI bridge is unavailable' };
      }
      return api.complete(payload);
    },
  },
};

export async function openMarkdownFile(): Promise<OpenFileResult | null> {
  return electronApi.openFile();
}

export async function saveMarkdownFile(payload: SaveFilePayload): Promise<SaveFileResult | null> {
  return electronApi.saveFile(payload);
}

export function logToMain(payload: LogPayload): void {
  electronApi.logger.log(payload);
}

