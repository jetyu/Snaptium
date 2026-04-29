import { promises as fs } from 'node:fs';
import { loggerService } from './logger.service.js';

const logger = loggerService.createLogger('Electron:File Service');

export async function readUtf8(filePath: string): Promise<string> {
  logger.debug('Reading file', { filePath });
  return await fs.readFile(filePath, 'utf-8');
}

export async function writeUtf8(filePath: string, content: string): Promise<void> {
  logger.debug('Writing file', { filePath });
  await fs.writeFile(filePath, content, 'utf-8');
}
