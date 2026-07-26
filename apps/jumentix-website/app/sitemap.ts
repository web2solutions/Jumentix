import type { MetadataRoute } from 'next';

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
  '/roadmap',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const localizedRoutes = commercialRoutes.flatMap((route) => [
    route,
    `/pt-BR${route}`,
  ]);
  const routes = [...localizedRoutes, '/docs', '/docs/jumentix', '/docs/overview'];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: route.includes('changelog') ? 'daily' : 'weekly',
    priority: route === '' || route === '/pt-BR' ? 1 : 0.7,
  }));
}
