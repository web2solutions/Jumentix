import Link from 'next/link';
import { Button, Card, Container, Group, List, Stack, Text, Title } from '@mantine/core';

type UseCaseTemplateProps = {
  title: string;
  summary: string;
  bullets: string[];
};

export function UseCaseTemplate({ title, summary, bullets }: UseCaseTemplateProps) {
  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        <Title order={1}>{title}</Title>
        <Text c="dimmed">{summary}</Text>
        <Card withBorder>
          <Title order={3}>Why teams choose this path</Title>
          <List mt="sm" spacing="xs">
            {bullets.map((bullet) => (
              <List.Item key={bullet}>{bullet}</List.Item>
            ))}
          </List>
        </Card>
        <Group>
          <Button component={Link} href="/contact">
            Start a Pilot
          </Button>
          <Button component={Link} href="/docs/jumentix" variant="light">
            View Technical Docs
          </Button>
        </Group>
      </Stack>
    </Container>
  );
}
