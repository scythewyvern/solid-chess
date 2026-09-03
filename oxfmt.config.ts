import { defineConfig } from 'oxfmt'

export default defineConfig({
  ignorePatterns: ['node_modules'],
  semi: false,
  sortTailwindcss: true,
  singleQuote: true,
  jsxSingleQuote: true,
  sortImports: true,
  sortPackageJson: true,
  printWidth: 95,
  trailingComma: 'es5',
})
