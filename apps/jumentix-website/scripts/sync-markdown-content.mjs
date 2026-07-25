import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptFilePath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptFilePath);
const appRoot = path.resolve(scriptDir, '..');
const sourcesPath = path.join(appRoot, 'config', 'content-sources.json');
const outputDir = path.join(appRoot, 'content', 'jumentix');
const metaFile = path.join(outputDir, '_meta.ts');

function inferTitleFromSlug(slug) {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function normalizeLineEndings(text) {
  return text.replace(/\r\n/g, '\n');
}

function escapeForSingleQuotedTs(value) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function toTsObjectKey(key) {
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)) {
    return key;
  }
  return `'${escapeForSingleQuotedTs(key)}'`;
}

function sanitizeDocBody(markdown) {
  const normalized = normalizeLineEndings(markdown).trim();
  if (normalized.length === 0) {
    return 'No content available.';
  }
  return normalized;
}

async function readJsonFile(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function ensureDirectory(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeGeneratedDoc({ slug, title, description, source, body }) {
  const relativeSource = path.relative(appRoot, source).replaceAll('\\', '/');
  const target = path.join(outputDir, `${slug}.mdx`);
  const content = `---
title: "${title}"
description: "${description}"
---

> Source: \`${relativeSource}\`

${body}
`;
  await fs.writeFile(target, content, 'utf8');
}

async function writeMetaFile(entries) {
  const mappedLines = entries.map((entry, index) => {
    const key = toTsObjectKey(entry.slug);
    const isLast = index === entries.length - 1;
    return `  ${key}: '${escapeForSingleQuotedTs(entry.title)}'${isLast ? '' : ','}`;
  });

  const lines = [
    'export default {',
    ...mappedLines,
    '};',
    '',
  ];
  await fs.writeFile(metaFile, lines.join('\n'), 'utf8');
}

async function main() {
  await ensureDirectory(outputDir);
  const sourceEntries = await readJsonFile(sourcesPath);

  const preparedEntries = [];
  for (const item of sourceEntries) {
    const slug = item.slug;
    const title = item.title || inferTitleFromSlug(slug);
    const description = item.description || `${title} documentation page.`;
    const sourceFile = path.resolve(appRoot, item.source);

    let body = '';
    try {
      const raw = await fs.readFile(sourceFile, 'utf8');
      body = sanitizeDocBody(raw);
    } catch {
      body = `Source file not found: \`${path.relative(appRoot, sourceFile).replaceAll('\\', '/')}\``;
    }

    await writeGeneratedDoc({
      slug,
      title,
      description,
      source: sourceFile,
      body,
    });
    preparedEntries.push({ slug, title });
  }

  await writeMetaFile(preparedEntries);
  console.log(`Generated ${preparedEntries.length} website content pages in content/jumentix.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
