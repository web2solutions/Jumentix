/**
 * Strip engineering / internal-project material from Cana usage guides
 * before they are published on the website (consumer-only surface).
 */

const INTERNAL_DOC_NAMES = [
  'CANA-INDEXEDDB-ADAPTER',
  'CANA-RELEASE-READINESS',
  'SERVICE-MANAGEMENT-CANA-ADOPTION',
  'JUMENTIX-WORKSPACE-PACKAGES'
];

export function isCanaUsageGuideSource(sourceFile) {
  const base = sourceFile.replace(/\\/g, '/');
  return /\/CANA-USAGE-GUIDE(\.pt-BR)?\.md$/i.test(base);
}

export function isCanaPublishedSource(sourceFile) {
  const base = sourceFile.replace(/\\/g, '/');
  return (
    isCanaUsageGuideSource(sourceFile)
    || /\/packages\/cana\/README(\.pt-BR)?\.md$/i.test(base)
  );
}

export function toCanaConsumerMarkdown(markdown, { locale = 'en' } = {}) {
  let out = markdown.replace(/\r\n/g, '\n');

  // Drop the trailing Related section (points at design / internal docs).
  out = out.replace(/\n## Related\n[\s\S]*$/i, '\n');
  out = out.replace(/\n## Relacionados?\n[\s\S]*$/i, '\n');

  // Remove design-rationale pointers from the intro.
  out = out.replace(
    /For the design rationale behind these behaviours, see\n\[[^\]]+\]\([^)]+\)\. This document is about\nusing it\. Portuguese: \[[^\]]+\]\([^)]+\)\.\n\n/m,
    locale === 'pt-BR'
      ? ''
      : 'This guide is about using `@jumentix/cana` in your application.\n\n'
  );
  out = out.replace(
    /Para a fundamentação de projeto por trás desses comportamentos, veja\n\[[^\]]+\]\([^)]+\)\. Este\ndocumento é sobre usar\. Inglês: \[[^\]]+\]\([^)]+\)\.\n\n/m,
    'Este guia é sobre usar `@jumentix/cana` na sua aplicação.\n\n'
  );

  // Soften Dexie checklist wording (engineering process, not consumer need).
  out = out.replace(
    /Dexie's documentation was used as a checklist of \*which subjects to cover\*; every\nword, example and API here is Cana's own\.\n\n/m,
    ''
  );
  out = out.replace(
    /A documentação do Dexie foi usada como\nchecklist de \*quais assuntos cobrir\*; cada palavra, exemplo e API aqui é do\npróprio Cana\.\n\n/m,
    ''
  );

  // Workers host is not a stable public demo surface on the site yet.
  out = out.replace(/\n## 15\. Workers\n[\s\S]*?(?=\n## \d+\.|\n## Related|\n## Relacionados?\n|$)/i, '\n');
  out = out.replace(/^\d+\.\s*\[Workers\]\([^)]+\)\n/gim, '');

  // Drop any leftover links to internal markdown docs.
  for (const name of INTERNAL_DOC_NAMES) {
    const linkRe = new RegExp(`\\[[^\\]]+\\]\\([^)]*${name}[^)]*\\)`, 'gi');
    out = out.replace(linkRe, '');
  }

  // Collapse excessive blank lines left by removals.
  out = out.replace(/\n{3,}/g, '\n\n').trim();

  const playgroundHeading = locale === 'pt-BR'
    ? '## Playgrounds interativos'
    : '## Interactive playgrounds';
  const playgroundIntro = locale === 'pt-BR'
    ? 'Execute features públicas do Cana neste site (IndexedDB real; Reset apaga o banco efêmero).'
    : 'Run public Cana features on this site (real IndexedDB; Reset deletes the ephemeral database).';
  const playgroundIds = [
    'getting-started',
    'schema-versioning',
    'keys',
    'crud',
    'bulk',
    'query-explain',
    'transactions',
    'change-events',
    'hooks',
    'errors',
    'storage-durability',
    'crash-recovery',
    'export-import',
    'fallback-backend',
    'factory-adapter'
  ];
  const playgroundBlock = [
    playgroundHeading,
    '',
    playgroundIntro,
    '',
    ...playgroundIds.map((id) => `<CanaPlayground id="${id}" />`),
    ''
  ].join('\n');

  if (!out.includes('<CanaPlayground')) {
    out = `${out}\n\n${playgroundBlock}`;
  }

  return `${out.trim()}\n`;
}

export function assertNoCanaContentLeaks(markdown, sourceLabel) {
  const githubLeak = /https?:\/\/github\.com\/XpertMinds\/Jumentix\b/i.test(markdown);
  if (githubLeak) {
    throw new Error(
      `Cana consumer docs leak GitHub content links (${sourceLabel}). `
      + 'Publish in-site routes only.'
    );
  }
  for (const name of INTERNAL_DOC_NAMES) {
    if (markdown.includes(name)) {
      throw new Error(
        `Cana consumer docs still reference internal doc "${name}" (${sourceLabel}).`
      );
    }
  }
}
