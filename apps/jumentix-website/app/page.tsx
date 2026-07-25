import {
  Badge,
  Button,
  Card,
  Container,
  Group,
  Image,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';

export default function HomePage() {
  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
          <Stack>
            <Stack gap="sm">
              <Badge variant="light" size="lg">
                Enterprise Software Factory
              </Badge>
              <Title order={1}>Build Enterprise SaaS Faster with Jumentix</Title>
              <Text size="lg" c="dimmed">
                Launch modular monoliths, realtime APIs, and microservice-ready platforms with
                contract-first architecture and production governance from day one.
              </Text>
              <Group>
                <Button component="a" href="/contact" size="md">
                  Book an Enterprise Demo
                </Button>
                <Button component="a" href="/product" variant="light" size="md">
                  Explore Product
                </Button>
              </Group>
            </Stack>
          </Stack>
          <Stack>
            <Card withBorder radius="md" p="lg">
              <Stack align="center" gap="xs">
                <Image
                  src="/brand/jumentix-mascot.png"
                  alt="Jumentix mascot"
                  w={220}
                  h={220}
                  fit="contain"
                />
                <Text fw={600}>Jumentix</Text>
                <Text size="sm" c="dimmed" ta="center">
                  High-load software delivery with lean operational footprint.
                </Text>
              </Stack>
            </Card>
          </Stack>
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
          <Card withBorder>
            <Title order={4}>Accelerated Delivery</Title>
            <Text c="dimmed" mt="xs">
              Reduce platform bootstrap effort and let teams focus on business-critical features.
            </Text>
          </Card>
          <Card withBorder>
            <Title order={4}>Architecture Consistency</Title>
            <Text c="dimmed" mt="xs">
              DDD, Hexagonal Architecture, and Event-Driven patterns enforced across projects.
            </Text>
          </Card>
          <Card withBorder>
            <Title order={4}>Enterprise Governance</Title>
            <Text c="dimmed" mt="xs">
              Coverage gates, CI quality checks, and traceable delivery workflows built in.
            </Text>
          </Card>
        </SimpleGrid>

        <Card withBorder>
          <Title order={3}>Start with one team. Scale across your organization.</Title>
          <Text c="dimmed" mt="xs">
            Use Jumentix for your first strategic service, then standardize architecture and delivery
            patterns across all squads.
          </Text>
          <Group mt="md">
            <Button component="a" href="/use-cases" variant="outline">
              View Use Cases
            </Button>
            <Button component="a" href="/docs/jumentix" variant="subtle">
              Open Technical Docs
            </Button>
          </Group>
        </Card>
      </Stack>
    </Container>
  );
}
