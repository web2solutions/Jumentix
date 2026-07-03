import Link from 'next/link';
import { Button, Card, Container, Group, Stack, Text, Title } from '@mantine/core';

export default function PricingOrEngagementPage() {
  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        <Title order={1}>Engagement Model</Title>
        <Text c="dimmed">
          Jumentix adoption typically starts with an architecture pilot and expands to platform
          standardization across product lines.
        </Text>
        <Card withBorder>
          <Title order={4}>Recommended onboarding path</Title>
          <Text c="dimmed" mt="xs">
            Pilot - Team Enablement - Multi-squad Rollout - Platform Governance.
          </Text>
        </Card>
        <Group>
          <Button component={Link} href="/contact">
            Request Commercial Conversation
          </Button>
        </Group>
      </Stack>
    </Container>
  );
}
