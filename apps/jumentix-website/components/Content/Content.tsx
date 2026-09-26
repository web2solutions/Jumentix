'use client';

import { BorderAnimate } from '@gfazioli/mantine-border-animate';
import { Group, SimpleGrid, Stack, Text, ThemeIcon, Title, UnstyledButton } from '@mantine/core';
import { IconArrowRight, IconFileText, IconPackages } from '@tabler/icons-react';

import classes from './Content.module.css';
import { Sponsors } from '../Sponsors/Sponsors';

import type { BorderAnimateProps } from '@gfazioli/mantine-border-animate';

interface EcosystemBoxProps {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  beamProps?: Partial<BorderAnimateProps>;
}

const EcosystemBox = ({ href, icon, title, description, beamProps }: EcosystemBoxProps) => (
  <BorderAnimate h="100%" radius="lg" {...beamProps}>
    <UnstyledButton
      className={classes.card}
      component="a"
      href={href}
      p="xl"
      rel="noreferrer"
      target="_blank"
    >
      <Stack gap="sm">
        <Group gap="sm" wrap="nowrap">
          <ThemeIcon
            radius="md"
            size="lg"
            variant="gradient"
            gradient={{
              from: (beamProps?.colorFrom as string) ?? 'blue',
              to: (beamProps?.colorTo as string) ?? 'cyan'
            }}
          >
            {icon}
          </ThemeIcon>
          <Title order={3}>{title}</Title>
        </Group>
        <Text c="dimmed" fz="sm">
          {description}
        </Text>
        <Group c="blue" fw={500} fz="sm" gap={4}>
          Explore <IconArrowRight size={16} />
        </Group>
      </Stack>
    </UnstyledButton>
  </BorderAnimate>
);

// eslint-disable-next-line import-x/prefer-default-export -- single named export consumed via named imports/barrels; converting to default would change the module API
export const Content = () => (
  <Stack align="center" my="2vh">
    <SimpleGrid cols={{ base: 1, sm: 2 }} maw={860} mx="auto" my={32} spacing="xl" w="100%">
      <EcosystemBox
        description="Browse 25+ Mantine UI extensions — split panes, onboarding tours, players, parallax and more — ready to drop into this template."
        href="https://mantine-extensions.vercel.app/"
        icon={<IconPackages size={20} />}
        title="Mantine Extensions Hub"
        beamProps={{
          beamMode: 'path',
          colorFrom: 'cyan',
          colorTo: 'indigo',
          size: 'lg',
          duration: 6
        }}
      />
      <EcosystemBox
        description="Prefer Fumadocs? The same starter with fumadocs-core under the hood and a docs UI built 100% with Mantine."
        href="https://gfazioli.github.io/next-app-fumadocs-template/"
        icon={<IconFileText size={20} />}
        title="Fumadocs template"
        beamProps={{
          beamMode: 'conic',
          colorFrom: 'pink',
          colorTo: 'grape',
          size: 'md',
          duration: 8,
          reverse: true
        }}
      />
    </SimpleGrid>

    <Sponsors />
  </Stack>
);
