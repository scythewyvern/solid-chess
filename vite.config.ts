import solid from '@solidjs/vite-plugin'
import { defineConfig } from 'vite'
import { iconsSpritesheet } from 'vite-plugin-icons-spritesheet'

export default defineConfig({
  // Turnkey client mode: no index.html and no mount file — the plugin
  // generates the entries around src/App.tsx, wrapped in src/Document.tsx
  // (or a built-in shell). `vite build` prerenders the shell into
  // dist/client/index.html and emits a purely static dist/client.
  plugins: [
    solid({ start: true, diagnostics: true }), // add `ssr: true` for streaming SSR
    iconsSpritesheet({
      withTypes: true,
      inputDir: 'icons',
      outputDir: 'src/icon',
      typesOutputFile: 'src/icon/icons.ts',
      fileName: 'sprite.svg',
      formatter: 'oxfmt',
      iconNameTransformer: (fileName) => fileName.toLowerCase(),
    }),
  ],
  build: {
    target: 'esnext',
    // Keep images as asset files instead of inlining them into the JS bundle.
    assetsInlineLimit: 0,
  },
  resolve: {
    // Solid 2 moved the renderer to @solidjs/web; some Solid 1-era
    // dependencies (e.g. @solid-primitives/drag-drop prerelease) still
    // import from 'solid-js/web'.
    alias: [{ find: /^solid-js\/web$/, replacement: '@solidjs/web' }],
  },
})
