import { isValidElement } from 'react';

import type { ElementType, ReactNode } from 'react';

interface BlockquoteProps {
  children?: ReactNode;
  [key: string]: unknown;
}

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

// eslint-disable-next-line import-x/prefer-default-export -- single named export consumed via named imports/barrels; converting to default would change the module API
export function createMDXSourceBlockquote(DefaultBlockquote: ElementType<BlockquoteProps>) {
  const MDXSourceBlockquote = ({ children, ...props }: BlockquoteProps) => {
    const text = textFromNode(children).trim();

    if (isGeneratedSourceBlock(children)) {
      return (
        <span data-doc-source hidden data-agent-metadata="source">
          {text}
        </span>
      );
    }

    return <DefaultBlockquote {...props}>{children}</DefaultBlockquote>;
  };

  return MDXSourceBlockquote;
}
