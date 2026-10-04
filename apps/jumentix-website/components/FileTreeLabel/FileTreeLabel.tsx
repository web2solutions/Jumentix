'use client';

import React from 'react';

import { Anchor, Group } from '@mantine/core';
import { IconCornerRightDown } from '@tabler/icons-react';

interface FileTreeLabelProps {
  name: string;
  type: 'folder' | 'file';
  children: React.ReactNode;
  color?: string;
  href?: string;
  target?: string;
}

// eslint-disable-next-line import-x/prefer-default-export -- single named export consumed via named imports/barrels; converting to default would change the module API
export const FileTreeLabel = ({
  name,
  type = 'folder',
  children,
  color = 'green',
  href,
  target = '_self'
}: FileTreeLabelProps) => (
  <Group>
    {href ? (
      <Anchor c="blue" href={href} target={target}>
        {name}
      </Anchor>
    ) : (
      name
    )}
    {type === 'folder' && <IconCornerRightDown color="grey" size={20} />}
    {children ? (
      <code
        className="jtx-inline-code"
        style={
          { '--jtx-inline-code-accent': `var(--mantine-color-${color}-6)` } as React.CSSProperties
        }
      >
        {children}
      </code>
    ) : null}
  </Group>
);
