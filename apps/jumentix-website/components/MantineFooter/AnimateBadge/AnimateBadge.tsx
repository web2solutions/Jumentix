import { Badge } from '@mantine/core';

import classes from './AnimateBadge.module.css';

import type { MantineColor } from '@mantine/core';

interface AnimateBadgeProps {
  label?: string;
  color?: MantineColor;
  size?: string;
  fontSize?: number;
}

// eslint-disable-next-line import-x/prefer-default-export -- single named export consumed via named imports/barrels; converting to default would change the module API
export const AnimateBadge = ({
  label = 'New',
  color = 'red',
  size = 'xs',
  fontSize = 10
}: AnimateBadgeProps) => (
  <Badge className={classes.badgeNew} color={color} fz={fontSize} size={size}>
    {label}
  </Badge>
);
