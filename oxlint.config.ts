import solidV2 from 'eslint-plugin-solid/configs/v2'
import { defineConfig } from 'oxlint'

export default defineConfig({
  jsPlugins: ['eslint-plugin-solid'],
  ignorePatterns: ['**/*.gen.ts', 'dist'],
  settings: solidV2.settings,
  rules: {
    ...solidV2.rules,
    complexity: 'error',
  },
  categories: {
    correctness: 'error',
  },
  plugins: ['oxc', 'typescript', 'promise', 'unicorn'],
  env: { builtin: true },
  options: {
    typeAware: true,
    typeCheck: true,
  },
})
