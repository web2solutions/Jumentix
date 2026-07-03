import { Card, Container, List, Stack, Text, Title } from '@mantine/core';

export default function ArchitecturePage() {
  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        <Title order={1}>Architecture</Title>
        <Text c="dimmed">
          Jumentix enforces DDD, Event-Driven Design, and Hexagonal Architecture as non-functional
          requirements.
        </Text>
        <Card withBorder>
          <List spacing="xs">
            <List.Item>Domain-first module boundaries</List.Item>
            <List.Item>Ports and adapters isolation</List.Item>
            <List.Item>Contract-driven interface exposure</List.Item>
            <List.Item>Event and message flow consistency</List.Item>
          </List>
        </Card>
      </Stack>
    </Container>
  );
}
