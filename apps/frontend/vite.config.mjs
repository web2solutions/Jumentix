import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'
import autoprefixer from 'autoprefixer'

export default defineConfig(() => {
  return {
    plugins: [vue()],
    base: './',
    css: {
      postcss: {
        plugins: [
          autoprefixer({}), // add options if needed
        ],
      },
    },
    resolve: {
      alias: [
        // webpack path resolve to vitejs
        {
          find: /^~(.*)$/,
          replacement: '$1',
        },
        {
          find: '@/',
          replacement: `${path.resolve(__dirname, 'src')}/`,
        },
        {
          find: '@',
          replacement: path.resolve(__dirname, '/src'),
        },
        {
          // JUM-680 pattern: consume workspace packages from source, not from
          // a dist that may not exist on a clean checkout.
          find: /^@jumentix\/sdk-rest-client$/,
          replacement: path.resolve(__dirname, '../../packages/sdk-rest-client/src/index.ts'),
        },
        {
          // The canonical loader reads the spec from disk (node:fs) — the
          // browser always injects the bundled OAS instead (requirement 136).
          find: /^@jumentix\/shared-contracts$/,
          replacement: path.resolve(__dirname, 'src/contracts/sharedContractsBrowserShim.ts'),
        },
      ],
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue', '.scss'],
    },
    server: {
      port: 3001,
      proxy: {
        // Dev-only: same-origin tunnel to the standalone backend instance
        // (express + InMemory). 3000 is the repo default; this workspace uses
        // JUMENTIX_HTTP_PORT=3010 so parallel agent backends never collide.
        '/api': 'http://localhost:3010',
      },
    },
  }
})
