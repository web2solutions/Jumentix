import { Card, Container, List, SimpleGrid, Stack, Text, Title, ListItem } from '@mantine/core';

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
              <ListItem>REST adapters (Express, Fastify, Restify, and more)</ListItem>
              <ListItem>Realtime adapters (WebSocket, gRPC)</ListItem>
              <ListItem>Function adapters (Cloud providers and edge runtimes)</ListItem>
            </List>
          </Card>
          <Card withBorder>
            <Title order={4}>Data and Messaging</Title>
            <List mt="sm" spacing="xs">
              <ListItem>SQL and NoSQL repository adapters</ListItem>
              <ListItem>In-memory official adapter for local development</ListItem>
              <ListItem>Message mediator with request/response and pub/sub patterns</ListItem>
            </List>
          </Card>
        </SimpleGrid>
      </Stack>
    </Container>
  );
}
