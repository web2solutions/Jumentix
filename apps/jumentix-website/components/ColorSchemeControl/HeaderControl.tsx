'use client';

import { polymorphic, Tooltip, UnstyledButton } from '@mantine/core';
import cx from 'clsx';

import classes from './HeaderControl.module.css';

import type { BoxProps } from '@mantine/core';

export interface HeaderControlProps extends BoxProps {
  tooltip: string;
  'aria-label'?: string;
  children: React.ReactNode;
}

const HeaderControlBase = ({
  tooltip,
  className,
  'aria-label': label,
  ...others
}: HeaderControlProps) => (
  <Tooltip label={tooltip}>
    <UnstyledButton
      aria-label={label || tooltip}
      className={cx(classes.control, className)}
      {...others}
    />
  </Tooltip>
);

export const HeaderControl = polymorphic<'button', HeaderControlProps>(HeaderControlBase);
