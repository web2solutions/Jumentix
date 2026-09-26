'use client';

import {
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Skeleton,
  Stack,
  Text,
  Timeline
} from '@mantine/core';
import { IconBrandGithub, IconPackage } from '@tabler/icons-react';
import { MDXRemote } from 'nextra/mdx-remote';

import config from '@/config';
import { useMDXComponents } from '@/mdx-components';

import { useReleaseNotes } from './use-release-notes';

import type { Release } from './use-release-notes';

// eslint-disable-next-line import-x/prefer-default-export -- single named export consumed via named imports/barrels; converting to default would change the module API
export const ReleaseNotes = () => {
  const { data, error, isLoading } = useReleaseNotes();

  const components = useMDXComponents();

  if (error) {
    return (
      <Alert color="red" icon="⚠️" my={32} title="Failed to load releases">
        {error instanceof Error ? error.message : String(error)}
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <Stack align="center" mt={24} w="100%">
        <Group>
          <Text>Loading releases...</Text>
          <Loader type="dots" />
        </Group>
        <Skeleton height={200} radius={12} width="100%" />
        <Skeleton height={50} radius={12} width="100%" />
        <Skeleton height={20} radius={12} width="100%" />
      </Stack>
    );
  }

  if (data.length === 0) {
    return (
      <Stack align="flex-start" mt={24}>
        <Text>
          No tagged releases yet — the first one is coming. Follow the day-to-day history on the
          changelog page meanwhile.
        </Text>
        <Button
          color="orange"
          component="a"
          gradient={{ from: 'dark.9', to: 'dark.8', deg: 45 }}
          href="/changelog"
          leftSection={<IconBrandGithub size={18} />}
          radius="xl"
          size="sm"
          variant="gradient"
        >
          Open the changelog
        </Button>
      </Stack>
    );
  }

  return (
    <Stack mt={24}>
      <Timeline active={1} bulletSize={32} lineWidth={4}>
        {data.map((release: Release) => (
          <Timeline.Item
            key={release.id}
            bullet={<IconPackage size={20} />}
            className="x:tracking-tight x:target:animate-[fade-in_1.5s]"
            id={release.tag_name}
            title={<Badge size="xl">{release.tag_name}</Badge>}
          >
            <Text fw={800} mb={16} size="sm">
              {release.created_at}
            </Text>
            <MDXRemote compiledSource={release.body} components={components} />
          </Timeline.Item>
        ))}
      </Timeline>
      <Button
        color="orange"
        component="a"
        gradient={{ from: 'dark.9', to: 'dark.8', deg: 45 }}
        href={config.releaseNotes.url}
        leftSection={<IconBrandGithub size={18} />}
        radius="xl"
        size="sm"
        variant="gradient"
      >
        View full changelog on GitHub
      </Button>
    </Stack>
  );
};
