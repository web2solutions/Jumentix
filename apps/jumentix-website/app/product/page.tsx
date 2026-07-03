import Link from 'next/link';
import { Button, Card, Container, Group, List, Stack, Text, Title } from '@mantine/core';

export default function ProductPage() {
  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        <Title order={1}>Jumentix Product Capabilities</Title>
        <Text c="dimmed" size="lg">
          Jumentix combines architecture standards, reusable runtime adapters, and delivery
          governance to help enterprise teams ship faster with less risk.
        </Text>
        <Card withBorder>
          <Title order={3}>Core Capability Pillars</Title>
          <List mt="sm" spacing="xs">
            <List.Item>Contract-first APIs with OpenAPI and AsyncAPI support</List.Item>
            <List.Item>REST, realtime, and function-based deployment options</List.Item>
            <List.Item>Reusable package ecosystem for adapters and service communication</List.Item>
            <List.Item>Built-in CI, coverage, and governance controls</List.Item>
            <List.Item>Clear migration path from modular monolith to microservices</List.Item>
          </List>
        </Card>
        <Group>
          <Button component={Link} href="/contact">
            Talk to Architecture Team
          </Button>
          <Button component={Link} href="/integrations" variant="light">
            View Integrations
          </Button>
        </Group>
      </Stack>
    </Container>
  );
}
