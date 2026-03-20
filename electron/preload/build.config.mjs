import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createPreloadBuildConfig(outDir = path.resolve(__dirname), emptyOutDir = false) {
  return {
    build: {
      emptyOutDir,
      lib: {
        entry: path.resolve(__dirname, 'src/index.js'),
        formats: ['cjs'],
        fileName: () => 'index.js',
      },
      outDir,
      rollupOptions: {
        external: ['electron'],
        output: {
          banner: '// Generated from electron/preload/src/index.js. Edit the source file, not this build artifact.',
          exports: 'named',
        },
      },
    },
  };
}
