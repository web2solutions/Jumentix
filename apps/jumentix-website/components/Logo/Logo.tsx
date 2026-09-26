import { useMantineTheme } from '@mantine/core';
import { IconBuildingFactory2 } from '@tabler/icons-react';

// eslint-disable-next-line import-x/prefer-default-export -- single named export consumed via named imports/barrels; converting to default would change the module API
export const Logo = () => {
  const theme = useMantineTheme();

  return <IconBuildingFactory2 color={theme.colors.blue[5]} size={44} />;
};
