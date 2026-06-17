import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const isCi = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
const __dirname = dirname(fileURLToPath(import.meta.url));
const command = resolve(
  __dirname,
  `../../node_modules/.bin/electron-builder${process.platform === 'win32' ? '.cmd' : ''}`
);
const args = ['--win'];

if (!isCi) {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+$/, '')
    .replace('T', '-');
  const outputDir = `dist/package-local-${timestamp}`;

  console.log(`Local Windows package output: ${outputDir}`);

  args.push(
    '--x64',
    '--publish',
    'never',
    '--config.npmRebuild=false',
    '--config.win.signAndEditExecutable=false',
    `--config.directories.output=${outputDir}`
  );
}

args.push(...process.argv.slice(2));

const env = { ...process.env };

if (!isCi) {
  env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';
}

const result = spawnSync(command, args, {
  env,
  shell: process.platform === 'win32',
  stdio: 'inherit'
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
