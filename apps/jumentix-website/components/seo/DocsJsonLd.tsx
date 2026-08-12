import { JsonLd } from './JsonLd';

const SITE = 'https://jumentix-website.vercel.app';

export type DocsJsonLdProps = {
  title: string;
  description: string;
  pathSegments: string[];
  locale?: 'en' | 'pt-BR';
};

export function DocsJsonLd({
  title,
  description,
  pathSegments,
  locale = 'en'
}: DocsJsonLdProps) {
  const isPt = locale === 'pt-BR' || pathSegments[0] === 'pt-BR';
  const docsBase = isPt ? `${SITE}/docs/pt-BR/jumentix` : `${SITE}/docs/jumentix`;
  const pagePath = pathSegments
    .filter((part, index) => !(isPt && index === 0 && part === 'pt-BR'))
    .filter((part) => part !== 'jumentix')
    .join('/');
  const url = pagePath ? `${docsBase}/${pagePath}` : docsBase;

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Docs',
        item: `${SITE}/docs`
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Jumentix',
        item: docsBase
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: title,
        item: url
      }
    ]
  };

  const article = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: title,
    description,
    url,
    inLanguage: isPt ? 'pt-BR' : 'en',
    author: {
      '@type': 'Organization',
      name: 'Jumentix'
    },
    publisher: {
      '@type': 'Organization',
      name: 'Jumentix'
    }
  };

  const isGettingStarted = pagePath.includes('getting-started');
  const howTo = isGettingStarted
    ? {
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: title,
        description,
        step: [
          {
            '@type': 'HowToStep',
            position: 1,
            name: 'Install Bun',
            text: 'Install the pinned Bun toolchain and verify with bun --version.'
          },
          {
            '@type': 'HowToStep',
            position: 2,
            name: 'Learn the mental model',
            text: 'Read adapters → application → domain and contracts-first adoption.'
          },
          {
            '@type': 'HowToStep',
            position: 3,
            name: 'Follow REST then realtime then offline',
            text: 'Use the REST, Realtime, and SPA/PWA guides with on-site playgrounds.'
          }
        ]
      }
    : null;

  return (
    <>
      <JsonLd data={breadcrumb} />
      <JsonLd data={article} />
      {howTo ? <JsonLd data={howTo} /> : null}
    </>
  );
}
