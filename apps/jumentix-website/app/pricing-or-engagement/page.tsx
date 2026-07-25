import { Button, Card, Container, Group, Image, SimpleGrid, Stack, Text, Title } from '@mantine/core';

export default function PricingOrEngagementPage() {
  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
          <Stack gap="sm">
            <Title order={1}>Engagement Model</Title>
            <Text c="dimmed">
              Jumentix adoption typically starts with an architecture pilot and expands to platform
              standardization across product lines.
            </Text>
          </Stack>
          <Card withBorder radius="md" p="lg">
            <Group justify="center">
              <Image
                src="/brand/jumentix-mascot.png"
                alt="Jumentix mascot"
                w={170}
                h={170}
                fit="contain"
              />
            </Group>
          </Card>
        </SimpleGrid>
        <Card withBorder>
          <Title order={4}>Recommended onboarding path</Title>
          <Text c="dimmed" mt="xs">
            Pilot - Team Enablement - Multi-squad Rollout - Platform Governance.
          </Text>
        </Card>
        <Group>
          <Button component="a" href="/contact">
            Request Commercial Conversation
          </Button>
        </Group>
      </Stack>
    </Container>
  );
}
