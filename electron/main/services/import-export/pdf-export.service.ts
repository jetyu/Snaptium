import { promises as fs } from 'node:fs';
import path from 'node:path';
import { BrowserWindow, dialog, type SaveDialogOptions } from 'electron';
import { $t } from '../../utils/i18n.js';
import { getErrorMessage } from '../error.service.js';
import { loggerService } from '../logger.service.js';
import { sanitizeFsName } from './markdown.utils.js';

const logger = loggerService.createLogger('Main:Single Note PDF Export Service');

export interface SingleNotePdfExportPayload {
  title: string;
  html: string;
}

export interface SingleNotePdfExportResult {
  success: boolean;
  cancelled: boolean;
  filePath?: string;
  exportedAt?: number;
}

function getFocusedWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildPdfHtml(payload: SingleNotePdfExportPayload): string {
  const escapedTitle = escapeHtml(payload.title);
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapedTitle}</title>
  <style>
    @page { margin: 18mm 16mm; }
    * { box-sizing: border-box; }
    body {
      color: #1f2933;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 14px;
      line-height: 1.65;
      margin: 0;
    }
    h1, h2, h3, h4, h5, h6 {
      color: #111827;
      line-height: 1.25;
      margin: 1.4em 0 0.6em;
      page-break-after: avoid;
    }
    p, ul, ol, blockquote, pre, table { margin: 0 0 14px; }
    a { color: #2563eb; text-decoration: none; }
    blockquote {
      border-left: 3px solid #cbd5e1;
      color: #475569;
      padding-left: 12px;
    }
    code {
      background: #f1f5f9;
      border-radius: 4px;
      font-family: "SFMono-Regular", Consolas, monospace;
      font-size: 0.92em;
      padding: 0.12em 0.3em;
    }
    pre {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      overflow: hidden;
      padding: 12px;
      white-space: pre-wrap;
      word-break: break-word;
    }
    pre code { background: transparent; padding: 0; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #d8dee8; padding: 8px; text-align: left; }
    th { background: #f8fafc; }
    img, svg { height: auto; max-width: 100%; }
    .preview-code-block__toolbar,
    .preview-code-block__copy { display: none !important; }
    .preview-resource-placeholder {
      border: 1px dashed #cbd5e1;
      color: #64748b;
      display: inline-block;
      padding: 4px 8px;
    }
  </style>
</head>
<body>
  <main>
    <article class="markdown-body">${payload.html}</article>
  </main>
</body>
</html>`;
}

async function showPdfSaveDialog(title: string): Promise<string | null> {
  const defaultFileName = `${sanitizeFsName(title, 'Note')}.pdf`;
  const options: SaveDialogOptions = {
    title: $t('dataTransfer.notePdfExport.dialogTitle'),
    defaultPath: defaultFileName,
    filters: [
      { name: 'PDF', extensions: ['pdf'] },
    ],
  };
  const focusedWindow = getFocusedWindow();
  const result = focusedWindow
    ? await dialog.showSaveDialog(focusedWindow, options)
    : await dialog.showSaveDialog(options);

  if (result.canceled || !result.filePath) {
    return null;
  }

  return result.filePath.toLowerCase().endsWith('.pdf') ? result.filePath : `${result.filePath}.pdf`;
}

export const singleNotePdfExportService = {
  async exportNotePdf(payload: SingleNotePdfExportPayload): Promise<SingleNotePdfExportResult> {
    const filePath = await showPdfSaveDialog(payload.title);
    if (!filePath) {
      return {
        success: false,
        cancelled: true,
      };
    }

    const exportWindow = new BrowserWindow({
      show: false,
      width: 900,
      height: 1200,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    try {
      const html = buildPdfHtml(payload);
      await exportWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      const pdfBuffer = await exportWindow.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        margins: {
          marginType: 'default',
        },
      });
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, pdfBuffer);

      return {
        success: true,
        cancelled: false,
        filePath,
        exportedAt: Date.now(),
      };
    } catch (error) {
      logger.error(`Failed to export note PDF: ${getErrorMessage(error)}`);
      throw error;
    } finally {
      exportWindow.close();
    }
  },
};
