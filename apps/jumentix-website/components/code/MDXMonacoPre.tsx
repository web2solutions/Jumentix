'use client';

import type { ReactNode } from 'react';
import { isValidElement } from 'react';
import { MonacoCodeBlock } from './MonacoCodeBlock';

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

export function MDXMonacoPre(props: {
  children?: ReactNode;
  className?: string;
  [key: string]: unknown;
}) {
  const child = Array.isArray(props.children) ? props.children[0] : props.children;

  if (isValidElement<{ className?: string; children?: ReactNode }>(child)) {
    const code = textFromNode(child.props.children).replace(/\n$/, '');
    const language = languageFromClassName(child.props.className) ?? languageFromClassName(props.className);

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
