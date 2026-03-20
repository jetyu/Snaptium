import { defineConfig } from 'vite';
import { createPreloadBuildConfig } from './electron/preload/build.config.mjs';

export default defineConfig(createPreloadBuildConfig());
