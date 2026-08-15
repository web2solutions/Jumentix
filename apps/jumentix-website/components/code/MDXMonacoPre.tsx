'use client';

import type { ReactNode } from 'react';
import { isValidElement } from 'react';
import type { MDXCodeBlockSource } from './MDXCodeSourceProvider';
import { useMDXCodeSourceBlocks } from './MDXCodeSourceProvider';
import { MonacoCodeBlock } from './MonacoCodeBlock';
import { trimTrailingBlankCodeLines } from './normalizeCode';

function textFromNode(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textFromNode).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return textFromNode(node.props.children);
  if (typeof (node as Iterable<ReactNode>)?.[Symbol.iterator] === 'function') {
    return Array.from(node as Iterable<ReactNode>).map(textFromNode).join('');
  }
  return '';
}

function languageFromClassName(className: unknown): string | undefined {
  if (typeof className !== 'string') return undefined;
  const match = className.match(/language-([a-z0-9-]+)/i);
  return match?.[1];
}

function languageFromNode(node: ReactNode): string | undefined {
  if (node === null || node === undefined || typeof node === 'boolean') return undefined;
  if (typeof node === 'string' || typeof node === 'number') return undefined;
  if (Array.isArray(node)) {
    for (const child of node) {
      const language = languageFromNode(child);
      if (language) return language;
    }
    return undefined;
  }
  if (!isValidElement<{ children?: ReactNode; className?: string }>(node)) return undefined;

  return languageFromClassName(node.props.className) ?? languageFromNode(node.props.children);
}

function normalizeLanguageName(language: string | undefined): string | undefined {
  return language?.replace(/^language-/, '').toLowerCase();
}

function canonicalCodePrefix(value: string): string {
  return trimTrailingBlankCodeLines(value)
    .split('\n')
    .map((line) => (line.trim().length === 0 ? '' : line.replace(/\s+$/g, '')))
    .join('\n')
    .trimStart();
}

function findSourceBlock(
  sourceBlocks: MDXCodeBlockSource[],
  language: string | undefined,
  renderedCode: string
): string | undefined {
  const renderedPrefix = canonicalCodePrefix(renderedCode);
  if (renderedPrefix.length === 0) return undefined;

  const normalizedLanguage = normalizeLanguageName(language);
  const compatibleBlocks = sourceBlocks.filter((block) => {
    if (!normalizedLanguage) return true;
    return normalizeLanguageName(block.language) === normalizedLanguage;
  });

  const exactLanguageMatch = compatibleBlocks.find((block) =>
    canonicalCodePrefix(block.value).startsWith(renderedPrefix)
  );
  if (exactLanguageMatch) return exactLanguageMatch.value;

  return sourceBlocks.find((block) => canonicalCodePrefix(block.value).startsWith(renderedPrefix))?.value;
}

export function MDXMonacoPre(props: {
  children?: ReactNode;
  className?: string;
  [key: string]: unknown;
}) {
  const sourceBlocks = useMDXCodeSourceBlocks();
  const renderedCode = trimTrailingBlankCodeLines(textFromNode(props.children));
  const language = languageFromNode(props.children) ?? languageFromClassName(props.className);
  const code = findSourceBlock(sourceBlocks, language, renderedCode) ?? renderedCode;

  if (code.trim().length > 0) {
    return (
      <MonacoCodeBlock
        value={code}
        language={language}
        readOnly
        minHeight={140}
        ariaLabel={`${language ?? 'code'} documentation example`}
      />
    );
  }

  return (
    <pre {...props}>
      {props.children}
    </pre>
  );
}
