import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import vue from 'eslint-plugin-vue';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '.pnpm-store/**', 'target/**', '.electron-build/**', '.codex/**', '.agents/**'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
      globals: { AbortController: 'readonly', AbortSignal: 'readonly', BeforeUnloadEvent: 'readonly', HTMLElement: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly' },
    },
  },
  {
    files: ['**/*.{ts,vue}'],
    rules: {
      '@typescript-eslint/ban-ts-comment': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      'vue/multi-word-component-names': ['error', { ignores: ['App'] }],
    },
  },
);
