import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import astro from 'eslint-plugin-astro';
import globals from 'globals';
import ts from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['dist/**', '.astro/**', '.wrangler/**', 'node_modules/**']),
  js.configs.recommended,
  ts.configs.recommended,
  ...astro.configs.recommended,
  {
    files: ['**/*.{js,mjs,ts,astro}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: ['**/*.astro'],
    languageOptions: {
      parserOptions: { parser: ts.parser },
    },
  },
]);
