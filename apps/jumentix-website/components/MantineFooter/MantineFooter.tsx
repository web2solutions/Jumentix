'use client';

import { Anchor, Container, Divider, Group, Stack, Text } from '@mantine/core';
import { IconBrandGithubFilled } from '@tabler/icons-react';
import packageJson from '../../package.json';

export const MantineFooter = () => {
  return (
    <footer>
      <Divider my="xl" />
      <Container size="lg" pb="xl">
        <Stack gap="xs">
          <Text fw={600}>Jumentix</Text>
          <Text c="dimmed" size="sm">
            Enterprise software factory for high-speed, contract-first backend and frontend delivery.
          </Text>
          <Group gap="md">
            <Anchor href="/product">Product</Anchor>
            <Anchor href="/use-cases">Use Cases</Anchor>
            <Anchor href="/integrations">Integrations</Anchor>
            <Anchor href="/changelog">Changelog</Anchor>
            <Anchor href="/security-compliance">Security</Anchor>
            <Anchor href="/contact">Contact</Anchor>
          </Group>
          <Group gap={8}>
            <IconBrandGithubFilled size={16} />
            <Anchor href="https://github.com/web2solutions/aaa-typescript-boilerplate">
              GitHub Repository
            </Anchor>
          </Group>
          <Text size="xs" c="dimmed">
            Website package version: {packageJson.version}
          </Text>
        </Stack>
      </Container>
    </footer>
  );
};
