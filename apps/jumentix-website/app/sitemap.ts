import type { MetadataRoute } from 'next';
import { readdirSync } from 'node:fs';
import path from 'node:path';

const baseUrl = 'https://jumentix-website.vercel.app';
const commercialRoutes = [
  '',
  '/product',
  '/use-cases',
  '/use-cases/rest-api',
  '/use-cases/realtime-api',
  '/use-cases/saas-monolith',
  '/use-cases/saas-microservices',
  '/use-cases/spa-pwa',
  '/architecture',
  '/integrations',
  '/changelog',
  '/security-compliance',
  '/pricing-or-engagement',
  '/contact',
  '/community',
  '/roadmap'
];

const documentationRoutes = (contentDirectory: string, routeBase: string): string[] => {
  const walk = (directory: string): string[] => readdirSync(
    directory,
    { withFileTypes: true }
  ).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    if (!entry.name.endsWith('.mdx')) return [];
    const relativePath = path
      .relative(contentDirectory, fullPath)
      .replaceAll('\\', '/')
      .replace(/(^|\/)index\.mdx$/, '')
      .replace(/\.mdx$/, '');
    return [`${routeBase}${relativePath ? `/${relativePath}` : ''}`];
  });

  return walk(contentDirectory);
};

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const localizedRoutes = commercialRoutes.flatMap((route) => [
    route,
    `/pt-BR${route}`
  ]);
  const contentRoot = path.join(process.cwd(), 'content');
  const routes = [
    ...localizedRoutes,
    '/docs',
    ...documentationRoutes(path.join(contentRoot, 'jumentix'), '/docs/jumentix'),
    ...documentationRoutes(path.join(contentRoot, 'pt-BR', 'jumentix'), '/docs/pt-BR/jumentix')
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: route.includes('changelog') ? 'daily' : 'weekly',
    priority: route === '' || route === '/pt-BR' ? 1 : 0.7
  }));
}
