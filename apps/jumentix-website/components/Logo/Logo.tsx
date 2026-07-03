import { IconBuildingFactory2 } from '@tabler/icons-react';
import { useMantineTheme } from '@mantine/core';

export function Logo() {
  const theme = useMantineTheme();

  return <IconBuildingFactory2 size={44} color={theme.colors.blue[5]} />;
}
