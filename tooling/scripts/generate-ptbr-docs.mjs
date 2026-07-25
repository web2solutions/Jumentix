#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const TARGET_LANG = 'pt';
const SOURCE_LANG = 'en';
const MAX_CHARS_PER_REQUEST = 3000;
const RETRY_LIMIT = 4;
const RETRY_BASE_MS = 800;

const shouldSkipFile = (filePath) => {
  if (!filePath.endsWith('.md')) return true;
  if (filePath.endsWith('.pt-BR.md')) return true;
  if (filePath.includes('node_modules/')) return true;
  if (filePath.startsWith('.agents/')) return true;
  if (filePath.startsWith('.github/')) return true;
  return false;
};

const getTargetPath = (filePath) => filePath.replace(/\.md$/i, '.pt-BR.md');

const getTrackedMarkdownFiles = () => {
  const stdout = execSync("git ls-files '*.md'", { cwd: ROOT, encoding: 'utf-8' });
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((filePath) => !shouldSkipFile(filePath));
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeWhitespace = (input) => input.replace(/\s+/g, ' ').trim();

const buildTranslateUrl = (text) => {
  const query = encodeURIComponent(text);
  return `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${SOURCE_LANG}&tl=${TARGET_LANG}&dt=t&q=${query}`;
};

const translateChunk = async (text) => {
  if (!text.trim()) return text;

  let lastError;
  for (let attempt = 1; attempt <= RETRY_LIMIT; attempt += 1) {
    try {
      const response = await fetch(buildTranslateUrl(text), {
        signal: AbortSignal.timeout(20000)
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      const translated = Array.isArray(payload?.[0])
        ? payload[0].map((part) => part?.[0] || '').join('')
        : '';
      if (!translated) {
        throw new Error('Empty translation payload');
      }
      return translated;
    } catch (error) {
      lastError = error;
      if (attempt < RETRY_LIMIT) {
        await sleep(RETRY_BASE_MS * attempt);
      }
    }
  }

  throw lastError;
};

const splitForTranslation = (text) => {
  if (text.length <= MAX_CHARS_PER_REQUEST) return [text];

  const parts = [];
  let cursor = 0;
  while (cursor < text.length) {
    let end = Math.min(cursor + MAX_CHARS_PER_REQUEST, text.length);
    if (end < text.length) {
      const breakByNewline = text.lastIndexOf('\n', end);
      const breakBySpace = text.lastIndexOf(' ', end);
      const bestBreak = Math.max(breakByNewline, breakBySpace);
      if (bestBreak > cursor + 200) {
        end = bestBreak;
      }
    }
    parts.push(text.slice(cursor, end));
    cursor = end;
  }
  return parts;
};

const preserveCodeBlocks = (markdown) => {
  const placeholders = [];
  let counter = 0;
  const transformed = markdown.replace(/```[\s\S]*?```/g, (match) => {
    const token = `__CODE_BLOCK_${counter}__`;
    placeholders.push({ token, value: match });
    counter += 1;
    return token;
  });

  return { transformed, placeholders };
};

const restorePlaceholders = (text, placeholders) => {
  return placeholders.reduce((acc, { token, value }) => acc.replace(token, value), text);
};

const translateMarkdown = async (markdown) => {
  const { transformed, placeholders } = preserveCodeBlocks(markdown);
  const paragraphs = transformed.split(/\n{2,}/);
  const translatedParagraphs = [];

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      translatedParagraphs.push(paragraph);
      continue;
    }

    if (paragraph.includes('__CODE_BLOCK_')) {
      translatedParagraphs.push(paragraph);
      continue;
    }

    const compact = normalizeWhitespace(paragraph);
    if (!compact) {
      translatedParagraphs.push(paragraph);
      continue;
    }

    const chunks = splitForTranslation(paragraph);
    const translatedChunks = [];
    for (const chunk of chunks) {
      translatedChunks.push(await translateChunk(chunk));
      await sleep(80);
    }
    translatedParagraphs.push(translatedChunks.join(''));
  }

  const translated = translatedParagraphs.join('\n\n');
  return restorePlaceholders(translated, placeholders);
};

const ensureParentDir = async (filePath) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
};

const writePortugueseVersion = async (sourcePath) => {
  const absoluteSource = path.join(ROOT, sourcePath);
  const sourceContent = await fs.readFile(absoluteSource, 'utf-8');
  const translatedBody = await translateMarkdown(sourceContent);

  const targetPath = getTargetPath(sourcePath);
  const absoluteTarget = path.join(ROOT, targetPath);

  const banner = [
    '<!--',
    `Arquivo gerado automaticamente a partir de: ${sourcePath}`,
    'Idioma alvo: Português (Brasil)',
    '-->',
    ''
  ].join('\n');

  await ensureParentDir(absoluteTarget);
  await fs.writeFile(absoluteTarget, `${banner}${translatedBody}\n`, 'utf-8');

  return targetPath;
};

const run = async () => {
  const files = getTrackedMarkdownFiles();
  console.log(`[pt-BR docs] arquivos encontrados: ${files.length}`);

  const created = [];
  for (let index = 0; index < files.length; index += 1) {
    const sourcePath = files[index];
    process.stdout.write(`[${index + 1}/${files.length}] traduzindo ${sourcePath} ... `);
    try {
      const targetPath = await writePortugueseVersion(sourcePath);
      created.push(targetPath);
      console.log(`ok -> ${targetPath}`);
    } catch (error) {
      console.log('erro');
      throw new Error(`Falha ao traduzir ${sourcePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(`[pt-BR docs] concluído. Arquivos gerados/atualizados: ${created.length}`);
};

run().catch((error) => {
  console.error('[pt-BR docs] erro:', error.message);
  process.exit(1);
});
