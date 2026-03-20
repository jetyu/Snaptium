import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { build } from 'vite';
import { createPreloadBuildConfig } from '../electron/preload/build.config.mjs';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'notewizard-preload-'));
const repoRoot = process.cwd();
const generatedPreloadPath = path.join(repoRoot, 'electron/preload/index.js');
const tempPreloadPath = path.join(tempDir, 'index.js');

try {
  await build(createPreloadBuildConfig(tempDir, true));

  const [currentPreload, rebuiltPreload] = await Promise.all([
    readFile(generatedPreloadPath, 'utf8'),
    readFile(tempPreloadPath, 'utf8'),
  ]);

  if (currentPreload !== rebuiltPreload) {
    console.error('electron/preload/index.js is out of date. Run: npm run build:preload');
    process.exitCode = 1;
  } else {
    console.log('electron/preload/index.js is up to date.');
  }
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
