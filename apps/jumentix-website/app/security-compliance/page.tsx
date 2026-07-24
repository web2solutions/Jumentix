import { Card, Container, List, Stack, Text, Title, ListItem } from '@mantine/core';

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
            <ListItem>Auth and RBAC hardening with test evidence</ListItem>
            <ListItem>Production error masking with non-production observability support</ListItem>
            <ListItem>Coverage and CI gates as quality control barriers</ListItem>
            <ListItem>Issue/PR traceability standards for auditability</ListItem>
          </List>
        </Card>
      </Stack>
    </Container>
  );
}
