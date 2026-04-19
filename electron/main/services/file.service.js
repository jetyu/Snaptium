import { promises as fs } from 'node:fs';
import { loggerService } from './logger.service.js';

const logger = loggerService.createLogger('Electron:File Service');

export async function readUtf8(filePath) {
  logger.debug('Reading file', { filePath });
  return fs.readFile(filePath, 'utf-8');
}

export async function writeUtf8(filePath, content) {
  logger.debug('Writing file', { filePath });
  return fs.writeFile(filePath, content, 'utf-8');
}
