import { useMantineColorScheme } from '@mantine/core';
import { useDidUpdate } from '@mantine/hooks';
import { useTheme } from 'nextra-theme-docs';

/**
 * This component is responsible for observing the theme changes in Nextra and Mantine.
 * By using this component, you can ensure that the Mantine theme is always in sync with the Nextra theme.
 *
 * This component is used in the MantineNavBar component.
 *
 * @since 1.0.0
 *
 * @see https://mantine.dev/docs/color-scheme/
 */
// eslint-disable-next-line import-x/prefer-default-export -- single named export consumed via named imports/barrels; converting to default would change the module API
export const MantineNextraThemeObserver = () => {
  const { setColorScheme } = useMantineColorScheme();
  const { theme } = useTheme();

  useDidUpdate(() => {
    if (theme === 'dark') {
      setColorScheme('dark');
      return;
    }
    setColorScheme(theme === 'system' ? 'auto' : 'light');
  }, [theme]);

  return null;
};
