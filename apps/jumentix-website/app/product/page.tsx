import { Button, Card, Container, Group, Image, List, SimpleGrid, Stack, Text, Title, ListItem } from '@mantine/core';

export default function ProductPage() {
  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
          <Stack gap="sm">
            <Title order={1}>Jumentix Product Capabilities</Title>
            <Text c="dimmed" size="lg">
              Jumentix combines architecture standards, reusable runtime adapters, and delivery
              governance to help enterprise teams ship faster with less risk.
            </Text>
          </Stack>
          <Card withBorder radius="md" p="lg">
            <Stack align="center" gap="xs">
              <Image
                src="/brand/jumentix-mascot.png"
                alt="Jumentix mascot"
                w={180}
                h={180}
                fit="contain"
              />
              <Text fw={600}>Built for enterprise scale</Text>
            </Stack>
          </Card>
        </SimpleGrid>
        <Card withBorder>
          <Title order={3}>Core Capability Pillars</Title>
          <List mt="sm" spacing="xs">
            <ListItem>Contract-first APIs with OpenAPI and AsyncAPI support</ListItem>
            <ListItem>REST, realtime, and function-based deployment options</ListItem>
            <ListItem>Reusable package ecosystem for adapters and service communication</ListItem>
            <ListItem>Built-in CI, coverage, and governance controls</ListItem>
            <ListItem>Clear migration path from modular monolith to microservices</ListItem>
          </List>
        </Card>
        <Group>
          <Button component="a" href="/contact">
            Talk to Architecture Team
          </Button>
          <Button component="a" href="/integrations" variant="light">
            View Integrations
          </Button>
        </Group>
      </Stack>
    </Container>
  );
}
