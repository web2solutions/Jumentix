import { generateStaticParamsFor, importPage } from 'nextra/pages';
import { MDXCodeSourceProvider } from '@/components/code/MDXCodeSourceProvider';
import { DocsJsonLd } from '@/components/seo/DocsJsonLd';
import { useMDXComponents as getMDXComponents } from '@/mdx-components';

export const generateStaticParams = generateStaticParamsFor('mdxPath');
export const revalidate = false;

type MdxPath = string[] | undefined;

const legacyAliases: Record<string, string[]> = {
  overview: ['concepts', 'overview'],
  'architecture-structure': ['concepts', 'architecture'],
  'rest-api-guide': ['guides', 'rest-api'],
  'realtime-api-guide': ['guides', 'realtime-api'],
  'spa-pwa-guide': ['guides', 'spa-pwa'],
  'saas-monolith-guide': ['guides', 'saas-monolith'],
  'saas-microservices-guide': ['guides', 'saas-microservices'],
  'security-pci': ['reference', 'security-compliance'],
  'runtime-contracts': ['reference', 'runtime-contracts'],
};

function getCandidates(mdxPath: MdxPath): string[][] {
  const normalized = Array.isArray(mdxPath) ? mdxPath.filter(Boolean) : [];

  if (normalized.length === 0) {
    return [['jumentix']];
  }

  if (normalized.length === 1 && normalized[0] === 'jumentix') {
    return [['jumentix']];
  }

  if (normalized[0] === 'pt-BR') {
    if (normalized.length === 1) return [['pt-BR', 'jumentix']];
    if (normalized[1] === 'jumentix') return [normalized];
    return [['pt-BR', 'jumentix', ...normalized.slice(1)]];
  }

  if (normalized[0] === 'jumentix') {
    const alias = normalized.length === 2 ? legacyAliases[normalized[1]] : undefined;
    if (alias) return [['jumentix', ...alias], normalized];
    return [normalized];
  }

  // Preserve the legacy /docs/:slug routes while using one canonical content tree.
  const alias = normalized.length === 1 ? legacyAliases[normalized[0]] : undefined;
  return [alias ? ['jumentix', ...alias] : ['jumentix', ...normalized]];
}

async function loadPageWithFallback(mdxPath: MdxPath) {
  let lastError: unknown;
  for (const candidate of getCandidates(mdxPath)) {
    try {
      return await importPage(candidate);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

export async function generateMetadata(props: any) {
  const params = await props.params;
  const { metadata } = await loadPageWithFallback(params?.mdxPath);
  const segments: string[] = Array.isArray(params?.mdxPath) ? params.mdxPath : [];
  const isPt = segments[0] === 'pt-BR';
  const canonicalPath = (() => {
    const candidates = getCandidates(params?.mdxPath);
    const canonical = candidates[0] ?? ['jumentix'];
    return `/docs/${canonical.join('/')}`;
  })();
  const languages: Record<string, string> = isPt
    ? {
        'pt-BR': `https://jumentix-website.vercel.app${canonicalPath}`,
        en: `https://jumentix-website.vercel.app${canonicalPath.replace('/docs/pt-BR/', '/docs/')}`
      }
    : {
        en: `https://jumentix-website.vercel.app${canonicalPath}`,
        'pt-BR': `https://jumentix-website.vercel.app${canonicalPath.replace('/docs/', '/docs/pt-BR/')}`
      };

  return {
    ...metadata,
    alternates: {
      canonical: `https://jumentix-website.vercel.app${canonicalPath}`,
      languages
    }
  };
}

export default async function Page(props: any) {
  const params = await props.params;
  const result = await loadPageWithFallback(params?.mdxPath);
  const { default: MDXContent, toc, metadata, sourceCode } = result;

  const customToc = [...toc, ...((metadata as any)?.toc || [])];
  const Wrapper = getMDXComponents().wrapper;
  const segments: string[] = Array.isArray(params?.mdxPath) ? params.mdxPath : ['jumentix'];

  return (
    <Wrapper toc={customToc} metadata={metadata} sourceCode={sourceCode}>
      <MDXCodeSourceProvider sourceCode={sourceCode}>
        <DocsJsonLd
          title={String((metadata as any)?.title ?? 'Jumentix Docs')}
          description={String((metadata as any)?.description ?? 'Jumentix framework documentation')}
          pathSegments={segments}
        />
        <MDXContent {...props} params={params} />
      </MDXCodeSourceProvider>
    </Wrapper>
  );
}
