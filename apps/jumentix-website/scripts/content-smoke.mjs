import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const appRoot = process.cwd();
const contentRoot = path.join(appRoot, 'content');
const englishRoot = path.join(contentRoot, 'jumentix');
const portugueseRoot = path.join(contentRoot, 'pt-BR', 'jumentix');

const listMdxFiles = (directory) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listMdxFiles(fullPath) : /\.mdx$/i.test(entry.name) ? [fullPath] : [];
  });

const relativeDocuments = (root) =>
  listMdxFiles(root)
    .map((file) => path.relative(root, file).replaceAll('\\', '/'))
    .sort();

const englishDocuments = relativeDocuments(englishRoot);
const portugueseDocuments = relativeDocuments(portugueseRoot);
const requiredDocuments = [
  'index.mdx',
  'concepts/index.mdx',
  'concepts/getting-started.mdx',
  'concepts/architecture.mdx',
  'guides/index.mdx',
  'guides/rest-api.mdx',
  'guides/realtime-api.mdx',
  'adapters/index.mdx',
  'adapters/http/express.mdx',
  'adapters/databases/mongodb.mdx',
  'adapters/realtime/index.mdx',
  'adapters/realtime/websocket-api.mdx',
  'packages/message-mediator/index.mdx',
  'packages/message-mediator/usage.mdx',
  'packages/designer-core/index.mdx',
  'packages/designer-core/usage.mdx',
  'packages/key-value-storage/index.mdx',
  'packages/key-value-storage/usage.mdx',
  'packages/mutex-service/index.mdx',
  'packages/mutex-service/usage.mdx',
  'packages/cana/index.mdx',
  'packages/cana/usage/index.mdx',
  'packages/cana/usage/getting-started.mdx',
  'packages/cana/usage/workers-testing.mdx',
  'reference/index.mdx',
  'reference/runtime-contracts.mdx',
];

const requiredAiSurfaces = [
  'llms.txt',
  'llms-full.txt',
  'docs-index.json',
];

for (const surface of requiredAiSurfaces) {
  const fullPath = path.join(appRoot, 'public', surface);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Required AI surface is missing: public/${surface}`);
  }
}

if (englishDocuments.length < 61) {
  throw new Error(`Expected at least 61 English documents, found ${englishDocuments.length}`);
}

if (JSON.stringify(englishDocuments) !== JSON.stringify(portugueseDocuments)) {
  const missingInPortuguese = englishDocuments.filter((document) => !portugueseDocuments.includes(document));
  const missingInEnglish = portugueseDocuments.filter((document) => !englishDocuments.includes(document));
  throw new Error(
    `Documentation locale trees differ. Missing in Portuguese: ${missingInPortuguese.join(', ') || 'none'}. ` +
      `Missing in English: ${missingInEnglish.join(', ') || 'none'}.`
  );
}

for (const requiredDocument of requiredDocuments) {
  if (!englishDocuments.includes(requiredDocument)) {
    throw new Error(`Required documentation route is missing: ${requiredDocument}`);
  }
}

for (const localeRoot of [englishRoot, portugueseRoot]) {
  for (const file of listMdxFiles(localeRoot)) {
    const content = fs.readFileSync(file, 'utf8');
    if (/undefined(?:#|\/)/.test(content)) {
      throw new Error(`Broken generated link marker found in ${file}`);
    }
    if (/\]\(\/docs\/[^)\s]+\/index(?:[)#])/.test(content)) {
      throw new Error(`Non-canonical documentation index route found in ${file}`);
    }
    if (/<!--[\s\S]*?-->/.test(content)) {
      throw new Error(`Unsupported HTML comment found in generated MDX: ${file}`);
    }
    if (!content.startsWith('---\n')) {
      throw new Error(`Generated documentation lacks frontmatter: ${file}`);
    }
    if (/github\.com\/XpertMinds\/Jumentix\/(?:blob|tree)/i.test(content)) {
      throw new Error(`GitHub content link leak in generated MDX: ${file}`);
    }
  }
}

console.log(
  `Documentation content smoke passed with ${englishDocuments.length} English and ${portugueseDocuments.length} Portuguese pages.`
);
