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
const monorepoRoot = path.resolve(appRoot, '../..');
const repositoryBlobBase =
  'https://github.com/web2solutions/aaa-typescript-boilerplate/blob/dev';

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

function toRepositoryUrl(filePath, anchor) {
  const relativePath = path.relative(monorepoRoot, filePath).replaceAll('\\', '/');
  const encodedPath = relativePath.split('/').map(encodeURIComponent).join('/');
  return `${repositoryBlobBase}/${encodedPath}${anchor}`;
}

async function resolveMarkdownTarget(sourceFile, hrefPath) {
  const decodedPath = decodeURIComponent(hrefPath);
  const initialTarget = path.resolve(path.dirname(sourceFile), decodedPath);
  const candidates = [initialTarget, `${initialTarget}.md`, `${initialTarget}.mdx`];

  for (const candidate of candidates) {
    try {
      const stats = await fs.stat(candidate);
      if (stats.isFile()) {
        return candidate;
      }
    } catch {
      // Try the next supported Markdown extension.
    }
  }

  return undefined;
}

async function rewriteRepositoryLinks(markdown, sourceFile, publishedRoutesBySource) {
  const linkPattern = /(?<!!)\[([^\]]+)\]\(([^)\s]+)\)/g;
  const links = [...markdown.matchAll(linkPattern)];
  const rewrittenByHref = new Map();

  for (const match of links) {
    const href = match[2];
    if (
      rewrittenByHref.has(href) ||
      href.startsWith('#') ||
      href.startsWith('/') ||
      /^[a-z][a-z\d+.-]*:/i.test(href)
    ) {
      continue;
    }

    const hashIndex = href.indexOf('#');
    const hrefPath = hashIndex === -1 ? href : href.slice(0, hashIndex);
    const anchor = hashIndex === -1 ? '' : href.slice(hashIndex);
    const target = await resolveMarkdownTarget(sourceFile, hrefPath);

    if (!target) {
      continue;
    }

    const publishedRoute = publishedRoutesBySource.get(target);
    rewrittenByHref.set(
      href,
      publishedRoute ? `${publishedRoute}${anchor}` : toRepositoryUrl(target, anchor)
    );
  }

  return markdown.replace(linkPattern, (fullMatch, label, href) => {
    const rewritten = rewrittenByHref.get(href);
    return rewritten ? `[${label}](${rewritten})` : fullMatch;
  });
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

async function hasUsableGeneratedDoc(slug) {
  const target = path.join(outputDir, `${slug}.mdx`);

  try {
    const current = await fs.readFile(target, 'utf8');
    return current.trim().length > 0 && !current.includes('Source file not found:');
  } catch {
    return false;
  }
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
  const publishedRoutesBySource = new Map(
    sourceEntries.map((entry) => [
      path.resolve(appRoot, entry.source),
      `/docs/jumentix/${entry.slug}`
    ])
  );

  const preparedEntries = [];
  for (const item of sourceEntries) {
    const slug = item.slug;
    const title = item.title || inferTitleFromSlug(slug);
    const description = item.description || `${title} documentation page.`;
    const sourceFile = path.resolve(appRoot, item.source);

    let body;
    try {
      const raw = await fs.readFile(sourceFile, 'utf8');
      body = sanitizeDocBody(
        await rewriteRepositoryLinks(raw, sourceFile, publishedRoutesBySource)
      );
    } catch (error) {
      if (await hasUsableGeneratedDoc(slug)) {
        console.warn(`Preserving generated page "${slug}" because its source is unavailable.`);
        preparedEntries.push({ slug, title });
        continue;
      }

      throw new Error(`Required documentation source is unavailable: ${sourceFile}`, {
        cause: error
      });
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
