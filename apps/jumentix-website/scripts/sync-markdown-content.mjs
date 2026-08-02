import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, '..');
const monorepoRoot = path.resolve(appRoot, '../..');
const sourcesPath = path.join(appRoot, 'config', 'content-sources.json');
const contentRoot = path.join(appRoot, 'content');
const repositoryBlobBase =
  'https://github.com/XpertMinds/Jumentix/blob/dev';

const localeConfig = {
  en: {
    basePath: '/docs/jumentix',
    outputDir: path.join(contentRoot, 'jumentix'),
    sourceKey: 'source',
    titleKey: 'title',
    descriptionKey: 'description',
  },
  'pt-BR': {
    basePath: '/docs/pt-BR/jumentix',
    outputDir: path.join(contentRoot, 'pt-BR', 'jumentix'),
    sourceKey: 'sourcePtBr',
    titleKey: 'titlePtBr',
    descriptionKey: 'descriptionPtBr',
  },
};

const sectionTitles = {
  en: {
    concepts: 'Concepts',
    guides: 'Guides',
    adapters: 'Adapters',
    packages: 'Packages',
    reference: 'Reference',
  },
  'pt-BR': {
    concepts: 'Conceitos',
    guides: 'Guias',
    adapters: 'Adaptadores',
    packages: 'Pacotes',
    reference: 'Referência',
  },
};

const normalizeLineEndings = (text) => text.replace(/\r\n/g, '\n');
const escapeForSingleQuotedTs = (value) =>
  value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const toTsObjectKey = (key) =>
  /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
    ? key
    : `'${escapeForSingleQuotedTs(key)}'`;
const slugify = (value) =>
  value
    .replace(/\.pt-BR$/i, '')
    .replace(/\.mdx?$/i, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

const inferTitle = (markdown, fallback) => {
  const heading = normalizeLineEndings(markdown)
    .split('\n')
    .find((line) => /^#\s+/.test(line));
  return heading
    ? heading.replace(/^#\s+/, '').replace(/[`*_]/g, '').trim()
    : fallback;
};

const sanitizeDocBody = (markdown) => {
  const normalized = normalizeLineEndings(markdown)
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();
  return normalized || 'No content available.';
};

const toRepositoryUrl = (filePath, anchor) => {
  const relativePath = path.relative(monorepoRoot, filePath).replaceAll('\\', '/');
  const encodedPath = relativePath.split('/').map(encodeURIComponent).join('/');
  return `${repositoryBlobBase}/${encodedPath}${anchor}`;
};

async function readJsonFile(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function resolveMarkdownTarget(sourceFile, hrefPath) {
  const initialTarget = path.resolve(path.dirname(sourceFile), decodeURIComponent(hrefPath));
  for (const candidate of [initialTarget, `${initialTarget}.md`, `${initialTarget}.mdx`]) {
    try {
      if ((await fs.stat(candidate)).isFile()) return candidate;
    } catch {
      // Continue through supported Markdown candidates.
    }
  }
  return undefined;
}

async function rewriteRepositoryLinks(markdown, sourceFile, routesBySource) {
  const linkPattern = /(?<!!)\[([^\]]+)\]\(([^)\s]+)\)/g;
  const replacements = new Map();

  for (const match of markdown.matchAll(linkPattern)) {
    const href = match[2];
    if (
      replacements.has(href) ||
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
    if (!target) continue;
    const publishedTarget = routesBySource.get(target);
    replacements.set(
      href,
      publishedTarget ? `${publishedTarget.route}${anchor}` : toRepositoryUrl(target, anchor)
    );
  }

  return markdown.replace(linkPattern, (fullMatch, label, href) =>
    replacements.has(href) ? `[${label}](${replacements.get(href)})` : fullMatch
  );
}

async function listMarkdownFiles(directory) {
  const files = [];
  for (const item of await fs.readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, item.name);
    if (item.isDirectory()) {
      files.push(...(await listMarkdownFiles(fullPath)));
    } else if (/\.md$/i.test(item.name)) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

/**
 * License texts, which are published as-is and never translated.
 *
 * The bilingual rule (Requirement 076) exists so documentation reaches both
 * audiences. A license is not documentation: the MIT text is the licence, and a
 * Portuguese rendering of it would be a second document with no legal standing
 * that readers could reasonably mistake for the terms. Shipping no translation
 * is the correct outcome, not a gap.
 *
 * `packages/cana/LICENSE.md` is the first of these in the tree, which is why the
 * collection walk had never encountered the case.
 */
function isLicense(sourceFile) {
  return /^licen[cs]e(\.[^.]+)?\.md$/i.test(path.basename(sourceFile));
}

function collectionSlug(sourceDir, sourceFile) {
  const relative = path.relative(sourceDir, sourceFile).replaceAll('\\', '/');
  const basename = path.basename(relative).replace(/\.pt-BR\.md$/i, '').replace(/\.md$/i, '');
  if (basename.toLowerCase() === 'readme') {
    const parent = path.dirname(relative);
    return parent === '.' ? 'index' : slugify(parent);
  }
  return slugify(basename);
}

async function prepareRecords(config) {
  const records = [];

  for (const entry of config.entries) {
    for (const [locale, localeSettings] of Object.entries(localeConfig)) {
      const source = path.resolve(appRoot, entry[localeSettings.sourceKey]);
      records.push({
        locale,
        section: entry.section,
        slug: entry.slug,
        title: entry[localeSettings.titleKey],
        description: entry[localeSettings.descriptionKey],
        source,
      });
    }
  }

  for (const collection of config.collections) {
    const sourceDir = path.resolve(appRoot, collection.sourceDir);
    const files = await listMarkdownFiles(sourceDir);
    const englishFiles = files.filter(
      (file) => !/\.pt-BR\.md$/i.test(file) && !isLicense(file),
    );

    for (const englishSource of englishFiles) {
      const portugueseSource = englishSource.replace(/\.md$/i, '.pt-BR.md');
      try {
        await fs.access(portugueseSource);
      } catch {
        throw new Error(`Missing Portuguese documentation pair: ${portugueseSource}`);
      }

      for (const [locale, source] of [['en', englishSource], ['pt-BR', portugueseSource]]) {
        const markdown = await fs.readFile(source, 'utf8');
        const fallbackTitle =
          locale === 'pt-BR' ? collection.titlePtBr : collection.title;
        records.push({
          locale,
          section: collection.section,
          slug: collectionSlug(sourceDir, source),
          title: inferTitle(markdown, fallbackTitle),
          description:
            locale === 'pt-BR'
              ? `Documentação de ${collection.titlePtBr}.`
              : `${collection.title} documentation.`,
          source,
        });
      }
    }
  }

  return records;
}

const recordRoute = (record) =>
  `${localeConfig[record.locale].basePath}/${record.section}${
    record.slug === 'index' ? '' : `/${record.slug}`
  }`;

async function writeGeneratedDoc(record, routesBySource) {
  const outputDirectory = path.join(localeConfig[record.locale].outputDir, record.section);
  await fs.mkdir(outputDirectory, { recursive: true });
  const raw = await fs.readFile(record.source, 'utf8');
  const body = sanitizeDocBody(
    await rewriteRepositoryLinks(raw, record.source, routesBySource)
  );
  const relativeSource = path.relative(appRoot, record.source).replaceAll('\\', '/');
  const content = `---
title: ${JSON.stringify(record.title)}
description: ${JSON.stringify(record.description)}
---

> Source: \`${relativeSource}\`

${body}
`;
  await fs.writeFile(path.join(outputDirectory, `${record.slug}.mdx`), content, 'utf8');
}

async function writeMeta(directory, entries) {
  const lines = ['export default {'];
  entries.forEach((entry, index) => {
    const value =
      entry.display === 'hidden'
        ? `{ title: '${escapeForSingleQuotedTs(entry.title)}', display: 'hidden' }`
        : `'${escapeForSingleQuotedTs(entry.title)}'`;
    const suffix = index === entries.length - 1 ? '' : ',';
    lines.push(`  ${toTsObjectKey(entry.slug)}: ${value}${suffix}`);
  });
  lines.push('};', '');
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, '_meta.ts'), lines.join('\n'), 'utf8');
}

function landingContent(locale, records) {
  const portuguese = locale === 'pt-BR';
  const sections = ['concepts', 'guides', 'adapters', 'packages', 'reference'];
  const links = sections
    .map((section) => {
      const first = records.find((record) => record.section.split('/')[0] === section);
      const href = first ? recordRoute(first) : localeConfig[locale].basePath;
      return `- [${sectionTitles[locale][section]}](${href})`;
    })
    .join('\n');

  return `---
title: ${JSON.stringify(portuguese ? 'Documentação do Jumentix' : 'Jumentix Documentation')}
description: ${JSON.stringify(portuguese ? 'Portal técnico do Jumentix.' : 'Jumentix technical documentation portal.')}
---

# ${portuguese ? 'Construa com o Jumentix' : 'Build with Jumentix'}

${portuguese
    ? 'Use este portal para aprender os conceitos, construir aplicações, escolher adaptadores e operar os pacotes do Jumentix.'
    : 'Use this portal to learn the concepts, build applications, choose adapters, and operate Jumentix packages.'}

\`\`\`bash
bun install
bun run cli
bun run dev:express
\`\`\`

## ${portuguese ? 'Explore a documentação' : 'Explore the documentation'}

${links}

## ${portuguese ? 'Jornadas recomendadas' : 'Recommended journeys'}

1. [${portuguese ? 'Compreenda a arquitetura' : 'Understand the architecture'}](${localeConfig[locale].basePath}/concepts/architecture)
2. [${portuguese ? 'Crie uma API REST' : 'Create a REST API'}](${localeConfig[locale].basePath}/guides/rest-api)
3. [${portuguese ? 'Escolha os adaptadores' : 'Choose adapters'}](${localeConfig[locale].basePath}/adapters/http)
4. [${portuguese ? 'Valide os contratos de runtime' : 'Validate runtime contracts'}](${localeConfig[locale].basePath}/reference/runtime-contracts)
`;
}

const sectionDisplayTitle = (locale, section) => {
  const parts = section.split('/');
  const leaf = parts.at(-1);
  if (parts.length === 1) return sectionTitles[locale][leaf] ?? leaf;
  const nestedTitles =
    locale === 'pt-BR'
      ? { http: 'HTTP', databases: 'Bancos de dados', realtime: 'Realtime' }
      : { http: 'HTTP', databases: 'Databases', realtime: 'Realtime' };
  return nestedTitles[leaf] ?? leaf;
};

function sectionLandingContent(locale, section, records) {
  const portuguese = locale === 'pt-BR';
  const title = sectionDisplayTitle(locale, section);
  const directRecords = records.filter(
    (record) => record.section === section && record.slug !== 'index'
  );
  const childSections = [...new Set(
    records
      .map((record) => record.section)
      .filter((candidate) => candidate.startsWith(`${section}/`))
      .map((candidate) => candidate.split('/').slice(0, section.split('/').length + 1).join('/'))
  )];
  const links = [
    ...childSections.map((child) => ({
      title: sectionDisplayTitle(locale, child),
      route: `${localeConfig[locale].basePath}/${child}`,
    })),
    ...directRecords.map((record) => ({ title: record.title, route: recordRoute(record) })),
  ];

  return `---
title: ${JSON.stringify(title)}
description: ${JSON.stringify(
    portuguese ? `Explore a seção ${title} do Jumentix.` : `Explore the Jumentix ${title} section.`
  )}
---

# ${title}

${portuguese
    ? 'Escolha um recurso para continuar sua jornada técnica com o Jumentix.'
    : 'Choose a resource to continue your technical journey with Jumentix.'}

${links.map((link) => `- [${link.title}](${link.route})`).join('\n')}
`;
}

async function writeNavigation(locale, records) {
  const outputDir = localeConfig[locale].outputDir;
  await fs.writeFile(path.join(outputDir, 'index.mdx'), landingContent(locale, records), 'utf8');

  await writeMeta(outputDir, [
    { slug: 'index', title: locale === 'pt-BR' ? 'Início' : 'Start', display: 'hidden' },
    ...['concepts', 'guides', 'adapters', 'packages', 'reference'].map((slug) => ({
      slug,
      title: sectionTitles[locale][slug],
    })),
  ]);

  const grouped = new Map();
  for (const record of records) {
    const parts = record.section.split('/');
    const key = record.section;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(record);

    if (parts.length > 1) {
      const parent = parts[0];
      if (!grouped.has(parent)) grouped.set(parent, []);
    }
  }

  for (const [section, sectionRecords] of grouped) {
    const directory = path.join(outputDir, section);
    if (!sectionRecords.some((record) => record.slug === 'index')) {
      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(
        path.join(directory, 'index.mdx'),
        sectionLandingContent(locale, section, records),
        'utf8'
      );
    }
    if (sectionRecords.length > 0) {
      await writeMeta(
        directory,
        sectionRecords.map((record) => ({
          slug: record.slug,
          title: record.title,
          display: record.slug === 'index' ? 'hidden' : undefined,
        }))
      );
      continue;
    }

    const children = [...new Set(
      records
        .map((record) => record.section)
        .filter((candidate) => candidate.startsWith(`${section}/`))
        .map((candidate) => candidate.split('/')[1])
    )];
    await writeMeta(
      directory,
      children.map((slug) => ({
        slug,
        title:
          locale === 'pt-BR'
            ? ({ http: 'HTTP', databases: 'Bancos de dados', realtime: 'Realtime' }[slug] ?? slug)
            : ({ http: 'HTTP', databases: 'Databases', realtime: 'Realtime' }[slug] ?? slug),
      }))
    );
  }
}

async function main() {
  const config = await readJsonFile(sourcesPath);
  const records = await prepareRecords(config);
  const routesBySource = new Map(
    records.map((record) => [record.source, { route: recordRoute(record), locale: record.locale }])
  );

  for (const settings of Object.values(localeConfig)) {
    await fs.rm(settings.outputDir, { recursive: true, force: true });
    await fs.mkdir(settings.outputDir, { recursive: true });
  }

  for (const record of records) {
    await writeGeneratedDoc(record, routesBySource);
  }

  for (const locale of Object.keys(localeConfig)) {
    await writeNavigation(locale, records.filter((record) => record.locale === locale));
  }

  await writeMeta(path.join(contentRoot, 'pt-BR'), [
    { slug: 'jumentix', title: 'Documentação Jumentix' },
  ]);

  console.log(
    `Generated ${records.length} localized documentation pages across English and Portuguese.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
