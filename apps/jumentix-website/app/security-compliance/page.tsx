import { Card, Container, List, Stack, Text, Title } from '@mantine/core';

export default function SecurityCompliancePage() {
  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        <Title order={1}>Security and Compliance</Title>
        <Text c="dimmed">
          Jumentix includes PCI-oriented hardening controls, environment-aware error exposure, and
          auditable delivery governance.
        </Text>
        <Card withBorder>
          <List spacing="xs">
            <List.Item>Auth and RBAC hardening with test evidence</List.Item>
            <List.Item>Production error masking with non-production observability support</List.Item>
            <List.Item>Coverage and CI gates as quality control barriers</List.Item>
            <List.Item>Issue/PR traceability standards for auditability</List.Item>
          </List>
        </Card>
      </Stack>
    </Container>
  );
}
