'use client';

import { useMDXComponents as getDocsMDXComponents } from 'nextra-theme-docs';
import type { ElementType, ReactNode } from 'react';
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

/**
 * Languages a reader copies rather than reads (JUM-728).
 *
 * A shell fence is almost always one command someone is about to paste into a
 * terminal. Mounting an editor for it costs a scrollable viewport per block —
 * the guide page carried 19 of them, each with its own inner scrollbar, and
 * none with a copy button. These fences render through the theme's own `pre`
 * instead, which brings syntax highlighting, the copy button and a height that
 * matches the content.
 */
const SHELL_LANGUAGES = new Set([
  'bash',
  'sh',
  'shell',
  'shellscript',
  'shell-session',
  'zsh',
  'console',
  'powershell',
  'ps1'
]);

export function isShellLanguage(language: string | undefined): boolean {
  const normalized = normalizeLanguageName(language);
  return normalized !== undefined && SHELL_LANGUAGES.has(normalized);
}

type MDXPreProps = {
  children?: ReactNode;
  className?: string;
  /** Override the theme `pre` — tests inject their own; production resolves it below. */
  DefaultPre?: ElementType;
  [key: string]: unknown;
};

/**
 * The theme's `pre`, resolved inside this client module.
 *
 * `mdx-components.ts` is evaluated on the server, so it cannot call a function
 * exported from a `'use client'` module — it can only render one. Resolving the
 * theme component here keeps the whole decision on the client side of the
 * boundary.
 */
const THEME_PRE: ElementType = (getDocsMDXComponents() as { pre?: ElementType }).pre ?? 'pre';

export function MDXMonacoPre({ DefaultPre = THEME_PRE, ...props }: MDXPreProps) {
  const sourceBlocks = useMDXCodeSourceBlocks();
  const renderedCode = trimTrailingBlankCodeLines(textFromNode(props.children));
  // Nextra's syntax highlighter reports the fence language on the `pre` as
  // `data-language`; the `language-*` class only appears when the fence was not
  // highlighted. Reading the attribute first is what makes shell detection work
  // at all — without it every fence arrived with no language and Monaco fell
  // back to TypeScript, which is why `bash` blocks were highlighted as TS.
  const language =
    (typeof props['data-language'] === 'string' ? (props['data-language'] as string) : undefined)
    ?? languageFromNode(props.children)
    ?? languageFromClassName(props.className);
  const code = findSourceBlock(sourceBlocks, language, renderedCode) ?? renderedCode;

  if (isShellLanguage(language)) {
    // The theme's `pre` keeps the highlighted children and the copy button that
    // `defaultShowCopyCode` turns on in next.config.mjs.
    return <DefaultPre {...props} />;
  }

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
    <DefaultPre {...props}>
      {props.children}
    </DefaultPre>
  );
}

