import type { ElementType, ReactNode } from 'react';
import { isValidElement } from 'react';

type BlockquoteProps = {
  children?: ReactNode;
  [key: string]: unknown;
};

function textFromNode(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textFromNode).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return textFromNode(node.props.children);
  return '';
}

function isGeneratedSourceBlock(children: ReactNode): boolean {
  return /^Source:\s*/i.test(textFromNode(children).trim());
}

export function createMDXSourceBlockquote(
  DefaultBlockquote: ElementType<BlockquoteProps>
) {
  function MDXSourceBlockquote({ children, ...props }: BlockquoteProps) {
    const text = textFromNode(children).trim();

    if (isGeneratedSourceBlock(children)) {
      return (
        <span hidden data-doc-source data-agent-metadata="source">
          {text}
        </span>
      );
    }

    return <DefaultBlockquote {...props}>{children}</DefaultBlockquote>;
  }

  return MDXSourceBlockquote;
}
