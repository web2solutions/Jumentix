import { generateStaticParamsFor, importPage } from 'nextra/pages';
import { useMDXComponents as getMDXComponents } from '@/mdx-components';

export const generateStaticParams = generateStaticParamsFor('mdxPath');
export const revalidate = false;

type MdxPath = string[] | undefined;

function getCandidates(mdxPath: MdxPath): string[][] {
  const normalized = Array.isArray(mdxPath) ? mdxPath.filter(Boolean) : [];

  if (normalized.length === 0) {
    return [['jumentix']];
  }

  if (normalized.length === 1 && normalized[0] === 'jumentix') {
    return [['jumentix']];
  }

  if (normalized[0] === 'jumentix') {
    return [normalized];
  }

  // Preserve the legacy /docs/:slug routes while using one canonical content tree.
  return [['jumentix', ...normalized]];
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
  return metadata;
}

export default async function Page(props: any) {
  const params = await props.params;
  const result = await loadPageWithFallback(params?.mdxPath);
  const { default: MDXContent, toc, metadata, sourceCode } = result;

  const customToc = [...toc, ...((metadata as any)?.toc || [])];
  const Wrapper = getMDXComponents().wrapper;

  return (
    <Wrapper toc={customToc} metadata={metadata} sourceCode={sourceCode}>
      <MDXContent {...props} params={params} />
    </Wrapper>
  );
}
