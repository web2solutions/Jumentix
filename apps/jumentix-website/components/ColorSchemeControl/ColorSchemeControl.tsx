import { useComputedColorScheme, useMantineColorScheme } from '@mantine/core';
import { IconMoon, IconSun } from '@tabler/icons-react';
import cx from 'clsx';
import { useTheme } from 'nextra-theme-docs';

import classes from './ColorSchemeControl.module.css';
import { HeaderControl } from './HeaderControl';

// eslint-disable-next-line import-x/prefer-default-export -- single named export consumed via named imports/barrels; converting to default would change the module API
export const ColorSchemeControl = () => {
  const { setColorScheme } = useMantineColorScheme();
  const { setTheme } = useTheme();

  const computedColorScheme = useComputedColorScheme('dark', { getInitialValueInEffect: true });

  const handleColorSchemeChange = () => {
    const newColorScheme = computedColorScheme === 'light' ? 'dark' : 'light';
    setColorScheme(newColorScheme);
    setTheme(newColorScheme);
  };

  return (
    <HeaderControl
      aria-label="Toggle color scheme"
      onClick={handleColorSchemeChange}
      tooltip={`${computedColorScheme === 'dark' ? 'Light' : 'Dark'} mode`}
    >
      <IconSun className={cx(classes.icon, classes.light)} stroke={1.5} />
      <IconMoon className={cx(classes.icon, classes.dark)} stroke={1.5} />
    </HeaderControl>
  );
};
