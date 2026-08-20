/**
 * Build machine-readable surfaces for AI agents: llms.txt + docs-index.json.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, '..');
const contentRoot = path.join(appRoot, 'content');
const publicRoot = path.join(appRoot, 'public');
const SITE = 'https://jumentix-website.vercel.app';

async function walkMdx(directory) {
  const out = [];
  let entries = [];
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) out.push(...(await walkMdx(full)));
    else if (entry.name.endsWith('.mdx')) out.push(full);
  }
  return out;
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return { title: '', description: '', body: raw };
  const block = match[1];
  const title = block.match(/^title:\s*"(.*)"$/m)?.[1]
    ?? block.match(/^title:\s*'(.*)'$/m)?.[1]
    ?? '';
  const description = block.match(/^description:\s*"(.*)"$/m)?.[1]
    ?? block.match(/^description:\s*'(.*)'$/m)?.[1]
    ?? '';
  return { title, description, body: raw.slice(match[0].length) };
}

function toRoute(file, localeRoot, routeBase) {
  const relative = path.relative(localeRoot, file).replaceAll('\\', '/');
  const cleaned = relative
    .replace(/(^|\/)index\.mdx$/, '')
    .replace(/\.mdx$/, '');
  return `${routeBase}${cleaned ? `/${cleaned}` : ''}`;
}

function extractHeadings(body) {
  return body
    .split('\n')
    .filter((line) => /^#{1,3}\s+/.test(line))
    .map((line) => line.replace(/^#{1,3}\s+/, '').trim())
    .slice(0, 24);
}

async function main() {
  const enRoot = path.join(contentRoot, 'jumentix');
  const ptRoot = path.join(contentRoot, 'pt-BR', 'jumentix');
  const enFiles = await walkMdx(enRoot);
  const ptFiles = await walkMdx(ptRoot);

  const index = [];
  for (const file of enFiles) {
    const raw = await fs.readFile(file, 'utf8');
    const { title, description, body } = parseFrontmatter(raw);
    const url = `${SITE}${toRoute(file, enRoot, '/docs/jumentix')}`;
    const section = path.relative(enRoot, file).split(path.sep)[0] ?? 'root';
    index.push({
      title: title || path.basename(file, '.mdx'),
      url,
      description,
      section,
      locale: 'en',
      headings: extractHeadings(body)
    });
  }
  for (const file of ptFiles) {
    const raw = await fs.readFile(file, 'utf8');
    const { title, description, body } = parseFrontmatter(raw);
    const url = `${SITE}${toRoute(file, ptRoot, '/docs/pt-BR/jumentix')}`;
    const section = path.relative(ptRoot, file).split(path.sep)[0] ?? 'root';
    index.push({
      title: title || path.basename(file, '.mdx'),
      url,
      description,
      section,
      locale: 'pt-BR',
      headings: extractHeadings(body)
    });
  }

  await fs.mkdir(publicRoot, { recursive: true });
  await fs.writeFile(
    path.join(publicRoot, 'docs-index.json'),
    `${JSON.stringify(index, null, 2)}\n`,
    'utf8'
  );

  const pick = (pred) => index.filter((item) => item.locale === 'en' && pred(item));
  const lines = [
    '# Jumentix',
    '',
    '> Jumentix is a software factory framework for building REST, realtime, and offline apps with shared contracts.',
    '',
    `Site: ${SITE}`,
    `Docs index JSON: ${SITE}/docs-index.json`,
    '',
    '## Start here',
    `- Getting started: ${SITE}/docs/jumentix/concepts/getting-started`,
    `- Concepts overview: ${SITE}/docs/jumentix/concepts/overview`,
    `- Architecture: ${SITE}/docs/jumentix/concepts/architecture`,
    '',
    '## Guides',
    ...pick((i) => i.section === 'guides').map((i) => `- ${i.title}: ${i.url}`),
    '',
    '## Packages',
    ...pick((i) => i.section === 'packages' || i.url.includes('/packages/')).slice(0, 40).map((i) => `- ${i.title}: ${i.url}`),
    '',
    '## Adapters',
    ...pick((i) => i.section === 'adapters' || i.url.includes('/adapters/')).slice(0, 30).map((i) => `- ${i.title}: ${i.url}`),
    '',
    '## Reference',
    ...pick((i) => i.section === 'reference').map((i) => `- ${i.title}: ${i.url}`),
    '',
    '## Portuguese',
    `- Docs hub: ${SITE}/docs/pt-BR/jumentix`,
    `- Getting started: ${SITE}/docs/pt-BR/jumentix/concepts/getting-started`,
    ''
  ];
  await fs.writeFile(path.join(publicRoot, 'llms.txt'), lines.join('\n'), 'utf8');

  const full = index
    .filter((item) => item.locale === 'en')
    .map((item) => `# ${item.title}\n\nURL: ${item.url}\n\n${item.description}\n\nHeadings:\n${item.headings.map((h) => `- ${h}`).join('\n')}`)
    .join('\n\n---\n\n');
  await fs.writeFile(path.join(publicRoot, 'llms-full.txt'), `${full}\n`, 'utf8');

  console.log(
    `AI surfaces: ${index.length} docs → public/llms.txt, public/llms-full.txt, public/docs-index.json`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
