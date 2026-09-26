'use client';

import { Button, Group, useMantineColorScheme } from '@mantine/core';
import { useTheme } from 'next-themes';

// eslint-disable-next-line import-x/prefer-default-export -- single named export consumed via named imports/barrels; converting to default would change the module API
export const ColorSchemeToggle = () => {
  const { setColorScheme } = useMantineColorScheme();
  const { setTheme } = useTheme();

  /**
   * You might improve this component. Anyway, it's a good starting point.
   * As you can see we have to handle both the Mantine and Nextra dark mode.
   */

  return (
    <Group justify="center" mt="xl">
      <Button
        onClick={() => {
          setColorScheme('light');
          setTheme('light');
        }}
      >
        Light
      </Button>
      <Button
        onClick={() => {
          setColorScheme('dark');
          setTheme('dark');
        }}
      >
        Dark
      </Button>
      <Button
        onClick={() => {
          setColorScheme('auto');
          setTheme('system');
        }}
      >
        Auto
      </Button>
    </Group>
  );
};
