import { notFound } from 'next/navigation';
import {
  CommercialPage,
  CommercialUseCasePage,
  type CommercialPageName,
  type UseCaseName,
} from '@/components/commercial/CommercialPages';
import { CommercialChangelogPage } from '@/components/commercial/ChangelogPage';

const pages: Record<string, CommercialPageName> = {
  '': 'home',
  product: 'product',
  'use-cases': 'use-cases',
  integrations: 'integrations',
  architecture: 'architecture',
  'security-compliance': 'security',
  'pricing-or-engagement': 'engagement',
  contact: 'contact',
  community: 'community',
  roadmap: 'roadmap',
};

const useCases: UseCaseName[] = [
  'rest-api',
  'realtime-api',
  'saas-monolith',
  'saas-microservices',
  'spa-pwa',
];

export default async function PortuguesePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug?: string[] }>;
  searchParams?: Promise<{ page?: string }>;
}) {
  const { slug = [] } = await params;
  const path = slug.join('/');

  if (slug[0] === 'use-cases' && slug[1] && useCases.includes(slug[1] as UseCaseName)) {
    return <CommercialUseCasePage locale="pt-BR" name={slug[1] as UseCaseName} />;
  }

  if (path === 'changelog') {
    const { page } = (await searchParams) ?? {};
    return <CommercialChangelogPage locale="pt-BR" page={page} />;
  }

  const page = pages[path];
  if (!page) notFound();
  return <CommercialPage locale="pt-BR" page={page} />;
}
