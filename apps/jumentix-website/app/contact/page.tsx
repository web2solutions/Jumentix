import { Button, Card, Container, Stack, Text, TextInput, Textarea, Title } from '@mantine/core';

export default function ContactPage() {
  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <Title order={1}>Book an Enterprise Demo</Title>
        <Text c="dimmed">
          Share your product context and architecture goals. The team will respond with a suggested
          pilot plan.
        </Text>
        <Card withBorder>
          <Stack>
            <TextInput label="Work email" placeholder="name@company.com" />
            <TextInput label="Company" placeholder="Company name" />
            <Textarea
              label="What are you building?"
              placeholder="Describe your SaaS, expected scale, and timeline."
              minRows={4}
            />
            <Button>Submit Request</Button>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}
