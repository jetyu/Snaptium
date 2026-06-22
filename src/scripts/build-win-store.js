import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_STORE_CONFIG = {
  STORE_IDENTITY_NAME: 'jetyu.Snaptium',
  STORE_PUBLISHER: 'CN=35204487-FFB3-46AF-923C-85C032C655ED',
  STORE_PUBLISHER_DISPLAY_NAME: 'Snaptium Team',
  STORE_DISPLAY_NAME: 'Snaptium',
  STORE_APPLICATION_ID: 'jetyu.Snaptium'
};

const REQUIRED_STORE_ENV_VARS = Object.keys(DEFAULT_STORE_CONFIG);

const __dirname = dirname(fileURLToPath(import.meta.url));
const command = resolve(
  __dirname,
  `../../node_modules/.bin/electron-builder${process.platform === 'win32' ? '.cmd' : ''}`
);
const outputDir = 'dist/store';
const staleUnpackedTmpDir = `${outputDir}/win-unpacked.tmp`;
const env = {
  ...DEFAULT_STORE_CONFIG,
  ...process.env,
  CSC_IDENTITY_AUTO_DISCOVERY: process.env.CSC_IDENTITY_AUTO_DISCOVERY ?? 'false'
};

const missingEnvVars = REQUIRED_STORE_ENV_VARS.filter((name) => !env[name]?.trim());

if (missingEnvVars.length > 0) {
  console.error('Missing Microsoft Store packaging environment variables:');

  for (const name of missingEnvVars) {
    console.error(`- ${name}`);
  }

  console.error('');
  console.error('Set these values from Partner Center before running this script.');
  process.exit(1);
}

try {
  rmSync(staleUnpackedTmpDir, { recursive: true, force: true });
} catch (error) {
  console.error(`Failed to clean stale temporary directory: ${staleUnpackedTmpDir}`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const args = [
  '--win',
  'appx',
  '--x64',
  '--publish',
  'never',
  '--config.npmRebuild=false',
  `--config.directories.output=${outputDir}`,
  `--config.appx.identityName=${env.STORE_IDENTITY_NAME}`,
  `--config.appx.publisher=${env.STORE_PUBLISHER}`,
  `--config.appx.publisherDisplayName=${env.STORE_PUBLISHER_DISPLAY_NAME}`,
  `--config.appx.displayName=${env.STORE_DISPLAY_NAME}`,
  `--config.appx.applicationId=${env.STORE_APPLICATION_ID}`,
  '--config.appx.backgroundColor=#FFFFFF',
  ...process.argv.slice(2)
];

console.log(`Microsoft Store package output: ${outputDir}`);

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
