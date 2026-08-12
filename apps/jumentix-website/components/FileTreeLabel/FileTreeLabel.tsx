'use client';

import React from 'react';
import { IconCornerRightDown } from '@tabler/icons-react';
import { Anchor, Group } from '@mantine/core';

type FileTreeLabelProps = {
  name: string;
  type: 'folder' | 'file';
  children: React.ReactNode;
  color?: string;
  href?: string;
  target?: string;
};

export function FileTreeLabel({
  name,
  type = 'folder',
  children,
  color = 'green',
  href,
  target = '_self',
}: FileTreeLabelProps) {
  return (
    <Group>
      {href ? (
        <Anchor href={href} target={target} c="blue">
          {name}
        </Anchor>
      ) : (
        name
      )}
      {type === 'folder' && <IconCornerRightDown size={20} color="grey" />}
      {children && (
        <code
          className="jtx-inline-code"
          style={{ '--jtx-inline-code-accent': `var(--mantine-color-${color}-6)` } as React.CSSProperties}
        >
          {children}
        </code>
      )}
    </Group>
  );
}
