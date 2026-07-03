'use client';

import { Navbar } from 'nextra-theme-docs';
import { ActionIcon, Group, Text, Tooltip } from '@mantine/core';
import { IconBooks, IconMessages } from '@tabler/icons-react';
import { ColorSchemeControl } from '../ColorSchemeControl/ColorSchemeControl';
import { Logo } from '../Logo/Logo';
import { MantineNextraThemeObserver } from '../MantineNextraThemeObserver/MantineNextraThemeObserver';

/**
 * You can customize the Nextra NavBar component.
 * Don't forget to use the MantineProvider and MantineNextraThemeObserver components.
 *
 * @since 1.0.0
 *
 */
export const MantineNavBar = () => {
  return (
    <>
      <MantineNextraThemeObserver />
      <Navbar
        logo={
          <Group align="center" gap={4}>
            <Logo />
            <Text size="lg" fw={300} c="blue" visibleFrom="xl">
              Jumentix
            </Text>
          </Group>
        }
        chatLink="/contact"
        projectLink="https://github.com/web2solutions/aaa-typescript-boilerplate"
      >
        <Group gap="sm" wrap="nowrap">
          <ColorSchemeControl />
          <Tooltip label="Technical docs" withArrow>
            <ActionIcon
              component="a"
              href="/docs/jumentix"
              size="lg"
              radius="xl"
              variant="gradient"
              gradient={{ from: 'blue', to: 'cyan' }}
              aria-label="Technical docs"
            >
              <IconBooks size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Book enterprise demo" withArrow>
            <ActionIcon
              component="a"
              href="/contact"
              size="lg"
              radius="xl"
              variant="filled"
              color="green"
              aria-label="Book enterprise demo"
              styles={{ root: { color: 'var(--mantine-color-white)' } }}
            >
              <IconMessages size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Navbar>
    </>
  );
};
