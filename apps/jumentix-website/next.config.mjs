import bundleAnalyzer from '@next/bundle-analyzer';
import nextra from 'nextra';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(appRoot, '../..');

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const withNextra = nextra({
  latex: true,
  search: {
    codeblocks: false
  },
  contentDirBasePath: '/docs',
})

export default withNextra(
  withBundleAnalyzer({
    reactStrictMode: false,
    cleanDistDir: true,
    outputFileTracingRoot: monorepoRoot,
    transpilePackages: ['@jumentix/cana'],
    experimental: {
      optimizePackageImports: ['@mantine/core', '@mantine/hooks'],
    },
    turbopack: {
      root: monorepoRoot,
      rules: {
        '*.svg': {
          loaders: ['turbopack-inline-svg-loader'],
          condition: {
            content: /^[\s\S]{0,4000}$/, // <-- Inline SVGs smaller than ~4Kb (since Next.js v16)
          },
          as: '*.js',
        },
      },
    },
  }));
