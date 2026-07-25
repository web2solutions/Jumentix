import { generateStaticParamsFor, importPage } from 'nextra/pages';

export const generateStaticParams = generateStaticParamsFor('mdxPath');
export const revalidate = false;

type MdxPath = string[] | undefined;

function getCandidates(mdxPath: MdxPath): string[][] {
  const normalized = Array.isArray(mdxPath) ? mdxPath.filter(Boolean) : [];
  const candidates: string[][] = [];
  const seen = new Set<string>();
  const add = (candidate: string[]) => {
    if (candidate.length === 0) return;
    const key = candidate.join('/');
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(candidate);
  };

  if (normalized.length === 0) {
    add(['jumentix', 'index']);
    add(['index']);
    return candidates;
  }

  // If request doesn't include the section prefix, prioritize /jumentix first.
  // This avoids noisy failed resolutions like `private-next-content-dir/undefined`
  // for known routes such as /docs/realtime-api-guide.
  if (normalized[0] !== 'jumentix') {
    add(['jumentix', ...normalized]);
    add(normalized);
  } else {
    add(normalized);
  }

  // Section root fallbacks only (avoid invalid combos like overview/index).
  if (normalized.length === 1 && normalized[0] === 'jumentix') {
    add(['jumentix', 'overview']);
    add(['jumentix', 'index']);
  }

  return candidates;
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
  const { default: MDXContent, toc, metadata } = result;

  const customToc = [...toc, ...((metadata as any)?.toc || [])];

  return <MDXContent {...props} params={params} toc={customToc} metadata={metadata} />;
}
