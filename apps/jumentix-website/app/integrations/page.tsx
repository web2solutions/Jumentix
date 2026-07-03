import { Card, Container, List, SimpleGrid, Stack, Text, Title } from '@mantine/core';

export default function IntegrationsPage() {
  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        <Title order={1}>Integrations</Title>
        <Text c="dimmed">
          Jumentix supports multiple runtime adapters and data technologies while preserving domain
          consistency.
        </Text>
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          <Card withBorder>
            <Title order={4}>Interface Adapters</Title>
            <List mt="sm" spacing="xs">
              <List.Item>REST adapters (Express, Fastify, Restify, and more)</List.Item>
              <List.Item>Realtime adapters (WebSocket, gRPC)</List.Item>
              <List.Item>Function adapters (Cloud providers and edge runtimes)</List.Item>
            </List>
          </Card>
          <Card withBorder>
            <Title order={4}>Data and Messaging</Title>
            <List mt="sm" spacing="xs">
              <List.Item>SQL and NoSQL repository adapters</List.Item>
              <List.Item>In-memory official adapter for local development</List.Item>
              <List.Item>Message mediator with request/response and pub/sub patterns</List.Item>
            </List>
          </Card>
        </SimpleGrid>
      </Stack>
    </Container>
  );
}
