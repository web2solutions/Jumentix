import { Card, Container, List, Stack, Text, Title, ListItem } from '@mantine/core';

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
            <ListItem>Domain-first module boundaries</ListItem>
            <ListItem>Ports and adapters isolation</ListItem>
            <ListItem>Contract-driven interface exposure</ListItem>
            <ListItem>Event and message flow consistency</ListItem>
          </List>
        </Card>
      </Stack>
    </Container>
  );
}
