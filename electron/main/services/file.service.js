import { promises as fs } from 'node:fs';

export async function readUtf8(filePath) {
  return fs.readFile(filePath, 'utf-8');
}

export async function writeUtf8(filePath, content) {
  return fs.writeFile(filePath, content, 'utf-8');
}
