import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  assertNoCanaContentLeaks,
  isCanaPublishedSource,
  isCanaUsageGuideSource,
  toCanaConsumerMarkdown
} from './cana-consumer-filter.mjs';
import {
  assertNoContentLeaks,
  stripGitHubContentLinks
} from './content-leaks.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, '..');
const monorepoRoot = path.resolve(appRoot, '../..');
const sourcesPath = path.join(appRoot, 'config', 'content-sources.json');
const contentRoot = path.join(appRoot, 'content');


/**
 * Public site package docs policy (fail-closed):
 * - Never auto-publish a package whose package.json has `"private": true`.
 * - Never publish internal tooling/governance packages even if mis-labeled.
 * - Consumer-facing workspace packages appear only via explicit content-sources
 *   entries pointing at curated consumer markdown (not raw private READMEs).
 */
const NEVER_PUBLISH_PACKAGE_SLUGS = new Set([
  'config-eslint',
  'config-jest',
  'config-ts',
  'agent-registry',
  'security-scanner',
  'cli-init',
]);

const NESTED_PACKAGE_HUB_SLUGS = new Set([
  'cana',
  'designer-core',
  'key-value-storage',
  'mutex-service',
  'message-mediator',
]);

async function readPackagePrivateFlag(packageDir) {
  try {
    const raw = await fs.readFile(path.join(packageDir, 'package.json'), 'utf8');
    const meta = JSON.parse(raw);
    return Boolean(meta.private);
  } catch {
    // Fail closed: missing/unreadable package.json → treat as private.
    return true;
  }
}

async function shouldSkipPackagesCollectionSource(sourceDir, englishSource, slug) {
  if (slug === 'index') {
    // Monorepo packages/README lists private tooling; use the consumer hub entry instead.
    return true;
  }
  if (NEVER_PUBLISH_PACKAGE_SLUGS.has(slug) || NESTED_PACKAGE_HUB_SLUGS.has(slug)) {
    return true;
  }
  const packageDir = path.dirname(englishSource);
  // Only apply private:true to package folders directly under packages/.
  if (path.basename(path.dirname(packageDir)) === 'packages' || path.basename(sourceDir) === 'packages') {
    const isPrivate = await readPackagePrivateFlag(packageDir);
    if (isPrivate) return true;
  }
  return false;
}


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
  // Site-wide: never keep Jumentix GitHub content URLs in published bodies.
  const sanitized = stripGitHubContentLinks(markdown);
  const linkPattern = /(?<!!)\[([^\]]+)\]\(([^)\s]+)\)/g;
  const replacements = new Map();
  const labelOnly = new Map();

  for (const match of sanitized.matchAll(linkPattern)) {
    const href = match[2];
    const label = match[1];
    if (
      replacements.has(href)
      || labelOnly.has(href)
      || href.startsWith('#')
      || href.startsWith('/')
    ) {
      continue;
    }

    if (/^[a-z][a-z\d+.-]*:/i.test(href)) {
      if (/github\.com\/XpertMinds\/Jumentix/i.test(href)) {
        throw new Error(
          `Published docs cannot keep GitHub content link ${href} (${sourceFile})`
        );
      }
      continue;
    }

    const hashIndex = href.indexOf('#');
    const hrefPath = hashIndex === -1 ? href : href.slice(0, hashIndex);
    const anchor = hashIndex === -1 ? '' : href.slice(hashIndex);
    const target = await resolveMarkdownTarget(sourceFile, hrefPath);
    if (!target) {
      // Fail closed: do not invent GitHub URLs; keep the label for juniors.
      labelOnly.set(href, label);
      continue;
    }
    const publishedTarget = routesBySource.get(target);
    if (!publishedTarget) {
      // Fail closed: unpublished relative targets stay on-site as label text
      // until a content-sources entry publishes them.
      labelOnly.set(href, label);
      continue;
    }
    replacements.set(href, `${publishedTarget.route}${anchor}`);
  }

  return sanitized.replace(linkPattern, (fullMatch, label, href) => {
    if (replacements.has(href)) return `[${label}](${replacements.get(href)})`;
    if (labelOnly.has(href)) return labelOnly.get(href);
    return fullMatch;
  });
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
      const slug = collectionSlug(sourceDir, englishSource);
      if (
        collection.section === 'packages'
        && await shouldSkipPackagesCollectionSource(sourceDir, englishSource, slug)
      ) {
        continue;
      }

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
          slug,
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
  let raw = await fs.readFile(record.source, 'utf8');
  if (isCanaUsageGuideSource(record.source)) {
    raw = toCanaConsumerMarkdown(raw, { locale: record.locale });
  }
  const body = sanitizeDocBody(
    await rewriteRepositoryLinks(raw, record.source, routesBySource)
  );
  if (isCanaPublishedSource(record.source)) {
    assertNoCanaContentLeaks(body, record.source);
  }
  assertNoContentLeaks(body, record.source);
  const relativeSource = path.relative(appRoot, record.source).replaceAll('\\', '/');
  const description = record.description
    || (record.locale === 'pt-BR'
      ? 'Documentação do framework Jumentix para adoção rápida.'
      : 'Jumentix framework documentation for fast adoption.');
  const content = `---
title: ${JSON.stringify(record.title)}
description: ${JSON.stringify(description)}
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

1. [${portuguese ? 'Começando' : 'Getting started'}](${localeConfig[locale].basePath}/concepts/getting-started)
2. [${portuguese ? 'Compreenda a arquitetura' : 'Understand the architecture'}](${localeConfig[locale].basePath}/concepts/architecture)
3. [${portuguese ? 'Crie uma API REST' : 'Create a REST API'}](${localeConfig[locale].basePath}/guides/rest-api)
4. [${portuguese ? 'Escolha os adaptadores' : 'Choose adapters'}](${localeConfig[locale].basePath}/adapters/http)
5. [${portuguese ? 'Valide os contratos de runtime' : 'Validate runtime contracts'}](${localeConfig[locale].basePath}/reference/runtime-contracts)
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

  const juniorIntro = (() => {
    if (section === 'reference') {
      return portuguese
        ? `Mapas e contratos do dia a dia — exemplos primeiro.\n\n## Comece aqui\n\n1. Erros quando um adapter devolve \`error\`.\n2. Eventos/mensagens para realtime e mediators.\n3. Contratos de runtime antes do deploy.\n4. Scripts de pacotes ao contribuir no monorepo.\n\n**Próximo:** [Começando](/docs/pt-BR/jumentix/concepts/getting-started).`
        : `Maps and contracts for day-to-day work — examples first.\n\n## Start here\n\n1. Errors when an adapter returns \`error\`.\n2. Events/messages for realtime and mediators.\n3. Runtime contracts before deploy.\n4. Package scripts when contributing.\n\n**Next:** [Getting started](/docs/jumentix/concepts/getting-started).`;
    }
    if (section === 'concepts') {
      return portuguese
        ? `Comece por **Começando**, depois visão geral e arquitetura.\n\n**Próximo:** [Começando](/docs/pt-BR/jumentix/concepts/getting-started).`
        : `Start with **Getting started**, then overview and architecture.\n\n**Next:** [Getting started](/docs/jumentix/concepts/getting-started).`;
    }
    return portuguese
      ? 'Escolha um recurso para continuar sua jornada técnica com o Jumentix.'
      : 'Choose a resource to continue your technical journey with Jumentix.';
  })();

  return `---
title: ${JSON.stringify(title)}
description: ${JSON.stringify(
    portuguese ? `Explore a seção ${title} do Jumentix.` : `Explore the Jumentix ${title} section.`
  )}
---

# ${title}

${juniorIntro}

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
    const childSlugs = [...new Set(
      records
        .map((record) => record.section)
        .filter((candidate) => candidate.startsWith(`${section}/`))
        .map((candidate) => candidate.split('/')[section.split('/').length])
        .filter(Boolean)
    )];

    const childTitle = (slug) => {
      const packageTitles = {
        cana: '@jumentix/cana',
        usage: locale === 'pt-BR' ? 'Guia de uso' : 'Usage guide',
        'designer-core': '@jumentix/designer-core',
        'key-value-storage': '@jumentix/key-value-storage',
        'mutex-service': '@jumentix/mutex-service',
        'message-mediator': '@jumentix/message-mediator'
      };
      if (packageTitles[slug]) return packageTitles[slug];
      if (locale === 'pt-BR') {
        return ({ http: 'HTTP', databases: 'Bancos de dados', realtime: 'Realtime' }[slug] ?? slug);
      }
      return ({ http: 'HTTP', databases: 'Databases', realtime: 'Realtime' }[slug] ?? slug);
    };

    if (sectionRecords.length > 0 || childSlugs.length > 0) {
      const metaEntries = [
        ...sectionRecords.map((record) => ({
          slug: record.slug,
          title: record.title,
          display: record.slug === 'index' ? 'hidden' : undefined,
        })),
        ...childSlugs.map((slug) => ({
          slug,
          title: childTitle(slug),
        })),
      ];
      if (section === 'packages/cana') {
        const order = ['index', 'usage', 'react-context', 'react-redux', 'vue-pinia'];
        metaEntries.sort((a, b) => {
          const aIndex = order.indexOf(a.slug);
          const bIndex = order.indexOf(b.slug);
          if (aIndex === -1 && bIndex === -1) return 0;
          if (aIndex === -1) return 1;
          if (bIndex === -1) return -1;
          return aIndex - bIndex;
        });
      }
      // Prefer nested package folders ahead of flat package pages when titles collide.
      const seen = new Set();
      const deduped = metaEntries.filter((entry) => {
        if (seen.has(entry.slug)) return false;
        seen.add(entry.slug);
        return true;
      });
      await writeMeta(directory, deduped);
      continue;
    }

    await writeMeta(
      directory,
      childSlugs.map((slug) => ({
        slug,
        title: childTitle(slug),
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

  const { spawn } = await import('node:child_process');
  await new Promise((resolve, reject) => {
    const child = spawn('bun', [path.join(scriptDir, 'generate-ai-surfaces.mjs')], {
      stdio: 'inherit',
      cwd: appRoot
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`generate-ai-surfaces failed with ${code}`));
    });
  });

  console.log(
    `Generated ${records.length} localized documentation pages across English and Portuguese.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
