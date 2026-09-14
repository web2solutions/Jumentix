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
          replacement: `${path.resolve(import.meta.dirname, 'src')}/`,
        },
        {
          find: '@',
          replacement: path.resolve(import.meta.dirname, '/src'),
        },
        {
          // JUM-680 pattern: consume workspace packages from source, not from
          // a dist that may not exist on a clean checkout.
          find: /^@jumentix\/sdk-rest-client$/,
          replacement: path.resolve(import.meta.dirname, '../../packages/sdk-rest-client/src/index.ts'),
        },
        {
          // The canonical loader reads the spec from disk (node:fs) — the
          // browser always injects the bundled OAS instead (requirement 136).
          find: /^@jumentix\/shared-contracts$/,
          replacement: path.resolve(import.meta.dirname, 'src/contracts/sharedContractsBrowserShim.ts'),
        },
      ],
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue', '.scss'],
    },
    server: {
      port: Number(process.env.VITE_DEV_PORT ?? 3001),
      proxy: {
        // Dev-only: same-origin tunnel to the standalone backend instance
        // (express + InMemory). 3000 is the repo default; this workspace uses
        // JUMENTIX_HTTP_PORT=3010 so parallel agent backends never collide.
        // Override both with VITE_DEV_PORT / VITE_API_PROXY_TARGET when
        // another agent already holds those ports on the same host.
        // Optional VITE_API_PROXY_TARGETS is JSON { "<serviceId>": "<url>" }
        // and adds `/api-<serviceId>` prefixes for a multi-service OAS.
        '/api': process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3010',
        ...Object.fromEntries(
          Object.entries(JSON.parse(process.env.VITE_API_PROXY_TARGETS || '{}')).map(
            ([id, target]) => [`/api-${id}`, target]
          )
        ),
      },
    },
  }
})
