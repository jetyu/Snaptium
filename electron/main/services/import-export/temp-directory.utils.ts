import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';

export async function createSecureTempDirectory(prefix: string): Promise<string> {
  const normalizedPrefix = prefix.trim();
  if (!normalizedPrefix) {
    throw new Error('Temporary directory prefix is required.');
  }

  if (normalizedPrefix.includes('/') || normalizedPrefix.includes('\\')) {
    throw new Error('Temporary directory prefix must not include path separators.');
  }

  return fs.mkdtemp(path.join(os.tmpdir(), `${normalizedPrefix}-`));
}
