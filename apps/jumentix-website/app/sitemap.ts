import type { MetadataRoute } from 'next';

const baseUrl = 'https://jumentix.vercel.app';

const staticRoutes = [
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
  '/docs',
  '/docs/jumentix'
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return staticRoutes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: route === '' ? 1 : 0.7
  }));
}
