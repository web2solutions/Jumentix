'use client';

import type { ReactNode } from 'react';
import { isValidElement } from 'react';
import { MonacoCodeBlock } from './MonacoCodeBlock';
import { trimTrailingBlankCodeLines } from './normalizeCode';

function textFromNode(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textFromNode).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return textFromNode(node.props.children);
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

export function MDXMonacoPre(props: {
  children?: ReactNode;
  className?: string;
  [key: string]: unknown;
}) {
  const code = trimTrailingBlankCodeLines(textFromNode(props.children));
  const language = languageFromNode(props.children) ?? languageFromClassName(props.className);

  if (code.trim().length > 0) {
    return (
      <MonacoCodeBlock
        value={code}
        language={language}
        readOnly
        minHeight={140}
        maxHeight={620}
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
