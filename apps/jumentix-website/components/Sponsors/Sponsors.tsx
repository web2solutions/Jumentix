'use client';

import { Anchor, Avatar, Button, Group, Stack, Text, Title } from '@mantine/core';
import { IconCoffee, IconHeartFilled, IconPlus } from '@tabler/icons-react';

import classes from './Sponsors.module.css';
import { sponsors } from '../MantineFooter/links';

/**
 * Sponsors wall — gradient title, pitch, sponsor avatars and the "Become a sponsor" CTA.
 * Rendered on the home page below the ecosystem boxes; the navbar Sponsor button
 * scrolls/navigates to the `#sponsors` anchor.
 */
// eslint-disable-next-line import-x/prefer-default-export -- single named export consumed via named imports/barrels; converting to default would change the module API
export const Sponsors = () => (
  <Stack align="center" className={classes.sponsorsSection} gap="md" id="sponsors" my={64}>
    <Title order={2} ta="center" tt="uppercase">
      <Text inherit component="span" gradient={{ from: 'pink', to: 'grape' }} variant="gradient">
        Sponsors
      </Text>
    </Title>
    <Text c="dimmed" fz={15} maw={560} ta="center">
      If my open-source work saves you or your team time, consider sponsoring its development.
      Sponsors get their name or logo featured here and across all my projects&rsquo; documentation
      sites.
    </Text>
    <Group gap="xl" justify="center">
      {sponsors.map((sponsor) => (
        <Anchor
          key={sponsor.key}
          href={sponsor.href ?? `https://github.com/${sponsor.github}`}
          rel="noopener noreferrer"
          target="_blank"
          underline="never"
        >
          <Stack align="center" gap={4}>
            <Avatar
              alt={sponsor.name}
              radius="xl"
              size="lg"
              src={`https://github.com/${sponsor.github}.png`}
            />
            <Text c="dimmed" fz={12}>
              {sponsor.name}
            </Text>
          </Stack>
        </Anchor>
      ))}
      <Anchor
        href="https://github.com/sponsors/gfazioli"
        rel="noopener noreferrer"
        target="_blank"
        underline="never"
      >
        <Stack align="center" gap={4}>
          <Avatar className={classes.sponsorSlot} radius="xl" size="lg">
            <IconPlus size={20} />
          </Avatar>
          <Text c="dimmed" fz={12}>
            Your logo here
          </Text>
        </Stack>
      </Anchor>
    </Group>
    <Group gap="sm" justify="center">
      <Button
        component="a"
        gradient={{ from: 'pink', to: 'grape' }}
        href="https://github.com/sponsors/gfazioli"
        leftSection={<IconHeartFilled size={16} />}
        radius="xl"
        rel="noopener noreferrer"
        target="_blank"
        variant="gradient"
      >
        Become a sponsor
      </Button>
      <Button
        color="yellow"
        component="a"
        href="https://donate.stripe.com/fZu4gy4Tn3b1dgudGx0co00"
        leftSection={<IconCoffee size={16} />}
        radius="xl"
        rel="noopener noreferrer"
        target="_blank"
        variant="filled"
        styles={{
          label: { color: 'var(--mantine-color-white)' },
          section: { color: 'var(--mantine-color-white)' }
        }}
      >
        Buy me a coffee
      </Button>
    </Group>
  </Stack>
);
