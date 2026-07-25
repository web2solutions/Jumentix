import { Button, Card, Container, Group, List, Stack, Text, Title, ListItem } from '@mantine/core';

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
              <ListItem key={bullet}>{bullet}</ListItem>
            ))}
          </List>
        </Card>
        <Group>
          <Button component="a" href="/contact">
            Start a Pilot
          </Button>
          <Button component="a" href="/docs/jumentix" variant="light">
            View Technical Docs
          </Button>
        </Group>
      </Stack>
    </Container>
  );
}
