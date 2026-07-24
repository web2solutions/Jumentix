import { Card, Container, Group, Image, SimpleGrid, Stack, Text, Title } from '@mantine/core';

const useCases = [
  { href: '/use-cases/rest-api', title: 'REST API', description: 'Contract-first enterprise APIs.' },
  {
    href: '/use-cases/realtime-api',
    title: 'Realtime API',
    description: 'WebSocket and gRPC integration with REST fallback.',
  },
  {
    href: '/use-cases/saas-monolith',
    title: 'SaaS Monolith',
    description: 'Modular monoliths designed for future decomposition.',
  },
  {
    href: '/use-cases/saas-microservices',
    title: 'SaaS Microservices',
    description: 'Domain-driven distributed services with shared contracts.',
  },
  { href: '/use-cases/spa-pwa', title: 'SPA/PWA', description: 'Frontend and backend aligned delivery.' },
];

export default function UseCasesPage() {
  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <Stack gap={2}>
            <Title order={1}>Use Cases</Title>
            <Text c="dimmed">Choose the delivery pattern that matches your product and scale goals.</Text>
          </Stack>
          <Image
            src="/brand/jumentix-mascot.png"
            alt="Jumentix mascot"
            w={84}
            h={84}
            fit="contain"
          />
        </Group>
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          {useCases.map((item) => (
            <Card key={item.href} withBorder component="a" href={item.href}>
              <Title order={3}>{item.title}</Title>
              <Text c="dimmed" mt="xs">
                {item.description}
              </Text>
            </Card>
          ))}
        </SimpleGrid>
      </Stack>
    </Container>
  );
}
