import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rendererChunkTargetSize = 480 * 1024;
const codeMirrorVendorSegments = [
  '/node_modules/@codemirror/',
  '/node_modules/@lezer/',
  '/node_modules/@marijn/find-cluster-break/',
  '/node_modules/crelt/',
  '/node_modules/style-mod/',
  '/node_modules/w3c-keyname/',
];

function normalizeModuleId(id: string): string {
  return id.replace(/\\/g, '/');
}

function isRendererLocaleModule(id: string): boolean {
  return normalizeModuleId(id).includes('/electron/assets/locales/');
}

function getRendererLocaleChunkName(id: string): string {
  const filename = normalizeModuleId(id).split('/').pop() ?? 'messages.json';
  return `locale-${filename.replace(/\.json(?:\?.*)?$/, '')}`;
}

function isRendererVendorModule(id: string): boolean {
  return id.includes('node_modules');
}

function isRendererCodeMirrorModule(id: string): boolean {
  const normalizedId = normalizeModuleId(id);
  return codeMirrorVendorSegments.some((segment) => normalizedId.includes(segment));
}

function getRendererVendorChunkName(id: string): string | null {
  if (!id.includes('node_modules')) {
    return null;
  }

  if (id.includes('@emoji-mart/data')) {
    return 'vendor-emoji-data';
  }

  if (id.includes('emoji-mart')) {
    return 'vendor-emoji-core';
  }

  if (isRendererCodeMirrorModule(id)) {
    return 'vendor-codemirror';
  }

  if (
    id.includes('markdown-it') ||
    id.includes('highlight.js') ||
    id.includes('dompurify') ||
    id.includes('katex')
  ) {
    return 'vendor-markdown';
  }

  if (
    id.includes('emoji-datasource-twitter')
  ) {
    return 'vendor-emoji';
  }

  if (id.includes('@icon-park')) {
    return 'vendor-icons';
  }

  if (id.includes('vue') || id.includes('pinia')) {
    return 'vendor-vue';
  }

  return 'vendor';
}

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag === 'em-emoji-picker',
        },
      },
    }),
  ],
  root: '.',
  base: './',
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          minSize: 20 * 1024,
          maxSize: rendererChunkTargetSize,
          groups: [
            {
              name: getRendererLocaleChunkName,
              test: isRendererLocaleModule,
              priority: 20,
            },
            {
              name: 'vendor-codemirror',
              test: isRendererCodeMirrorModule,
              priority: 30,
              maxSize: 1024 * 1024,
            },
            {
              name: getRendererVendorChunkName,
              test: isRendererVendorModule,
              priority: 10,
              maxSize: rendererChunkTargetSize,
              entriesAware: true,
            },
          ],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'electron/shared'),
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@assets': path.resolve(__dirname, 'electron/assets'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
});
