import type { Meta, StoryObj } from '@storybook/nextjs';
import {
  IconApi,
  IconArrowsShuffle,
  IconBinaryTree,
  IconCloudComputing,
  IconDatabase,
  IconShieldCheck,
} from '@tabler/icons-react';
import {
  ActionLink,
  ArchitectureFlow as ArchitectureFlowComponent,
  BrandMark as BrandMarkComponent,
  Callout as CalloutComponent,
  CapabilityTable as CapabilityTableComponent,
  CodeShowcase as CodeShowcaseComponent,
  DocsToolbar as DocsToolbarComponent,
  FeatureGrid as FeatureGridComponent,
  LocaleSwitch as LocaleSwitchComponent,
  MetricStrip as MetricStripComponent,
  Pagination as PaginationComponent,
  SearchField as SearchFieldComponent,
  SectionHeading as SectionHeadingComponent,
  SiteFooter as SiteFooterComponent,
  SiteHeader as SiteHeaderComponent,
  StatusBadge as StatusBadgeComponent,
} from '.';

const meta = {
  title: 'Design System/Overview',
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const BrandMark: Story = {
  render: () => <BrandMarkComponent />,
};

export const ActionLinks: Story = {
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      <ActionLink href="/docs/jumentix">Read the docs</ActionLink>
      <ActionLink href="/product" variant="secondary">
        Explore the platform
      </ActionLink>
      <ActionLink href="https://github.com/web2solutions/Jumentix" variant="quiet" external>
        View on GitHub
      </ActionLink>
    </div>
  ),
};

export const StatusBadges: Story = {
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <StatusBadgeComponent>Open source</StatusBadgeComponent>
      <StatusBadgeComponent tone="success">Production ready</StatusBadgeComponent>
      <StatusBadgeComponent tone="attention">Action required</StatusBadgeComponent>
    </div>
  ),
};

export const SectionHeading: Story = {
  render: () => (
    <SectionHeadingComponent
      eyebrow="Architecture without lock-in"
      title="Choose infrastructure at the edge of your application"
      description="Keep domain behavior stable while swapping databases, transports, queues, and deployment targets."
    />
  ),
};

export const FeatureGrid: Story = {
  render: () => (
    <FeatureGridComponent
      features={[
        {
          title: 'Contract-first interfaces',
          description: 'OpenAPI and AsyncAPI contracts drive HTTP, WebSocket, and gRPC delivery.',
          icon: <IconApi size={21} />,
        },
        {
          title: 'Portable persistence',
          description: 'A stable store port shields use cases from relational and document databases.',
          icon: <IconDatabase size={21} />,
        },
        {
          title: 'Service communication',
          description: 'Request-response and event messaging work in a monolith or across services.',
          icon: <IconArrowsShuffle size={21} />,
        },
      ]}
    />
  ),
};

export const Callout: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 12, maxWidth: 760 }}>
      <CalloutComponent title="Contract source of truth">
        Update the API contract whenever a request, response, event, message, or error changes.
      </CalloutComponent>
      <CalloutComponent title="Quality gate passed" tone="success">
        Unit tests, route resolution, security checks, and coverage meet the project policy.
      </CalloutComponent>
      <CalloutComponent title="Migration decision" tone="warning">
        Validate compatibility evidence before replacing an adapter in a production service.
      </CalloutComponent>
    </div>
  ),
};

export const MetricStrip: Story = {
  render: () => (
    <MetricStripComponent
      metrics={[
        { value: '12', label: 'HTTP adapters' },
        { value: '3', label: 'API protocols' },
        { value: '11', label: 'Database drivers' },
        { value: '99%', label: 'Coverage policy' },
      ]}
    />
  ),
};

export const CapabilityTable: Story = {
  render: () => (
    <CapabilityTableComponent
      rows={[
        { capability: 'REST API', implementation: 'OpenAPI 3.1 + framework adapters', status: 'Available' },
        { capability: 'Realtime API', implementation: 'Socket.IO + Redis Streams', status: 'Available' },
        { capability: 'gRPC API', implementation: '@grpc/grpc-js + AsyncAPI', status: 'Available' },
      ]}
    />
  ),
};

const codeSamples = [
  {
    label: 'CLI',
    language: 'shell',
    code: `bun install
bun run cli
bun run dev:express`,
  },
  {
    label: 'Controller',
    language: 'typescript',
    code: `export class OrganizationController {
  constructor(private readonly createOrganization: CreateOrganization) {}

  async create(input: CreateOrganizationInput) {
    return this.createOrganization.execute(input)
  }
}`,
  },
  {
    label: 'Message contract',
    language: 'typescript',
    code: `await mediator.request({
  contract: 'users.identity.verify.v1',
  payload: { token },
  correlationId,
})`,
  },
];

export const CodeShowcase: Story = {
  render: () => <CodeShowcaseComponent samples={codeSamples} />,
};

export const SearchField: Story = {
  render: () => <SearchFieldComponent />,
};

export const Pagination: Story = {
  render: () => <PaginationComponent current={2} total={5} />,
};

export const LocaleSwitch: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 8 }}>
      <LocaleSwitchComponent locale="EN" />
      <LocaleSwitchComponent locale="PT-BR" />
    </div>
  ),
};

export const SiteHeader: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => <SiteHeaderComponent />,
};

export const SiteHeaderMobile: Story = {
  parameters: {
    layout: 'fullscreen',
  },
  globals: {
    viewport: { value: 'mobile1', isRotated: false },
  },
  render: () => <SiteHeaderComponent />,
};

export const SiteFooter: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => <SiteFooterComponent />,
};

export const DocsToolbar: Story = {
  render: () => <DocsToolbarComponent />,
};

export const ArchitectureFlow: Story = {
  render: () => (
    <ArchitectureFlowComponent
      steps={[
        { title: 'Interface adapter', description: 'Receives a transport-specific request.' },
        { title: 'Controller', description: 'Maps the contract to an application command.' },
        { title: 'Use case', description: 'Coordinates domain behavior and ports.' },
        { title: 'Output adapter', description: 'Persists state or publishes a message.' },
      ]}
    />
  ),
};

export const ArchitectureFlowMobile: Story = {
  globals: {
    viewport: { value: 'mobile1', isRotated: false },
  },
  render: () => (
    <ArchitectureFlowComponent
      steps={[
        { title: 'HTTP', description: 'Express, Fastify, Workers, and more.' },
        { title: 'Application', description: 'Controllers and use cases.' },
        { title: 'Domain', description: 'Entities and business rules.' },
        { title: 'Infrastructure', description: 'Databases, queues, and clouds.' },
      ]}
    />
  ),
};

export const ComponentInventory: Story = {
  render: () => (
    <FeatureGridComponent
      features={[
        { title: 'Delivery', description: 'Headers, footers, CTAs, pagination, and locale controls.', icon: <IconCloudComputing size={21} /> },
        { title: 'Technical content', description: 'Code tabs, callouts, tables, search, and architecture flows.', icon: <IconBinaryTree size={21} /> },
        { title: 'Trust', description: 'Metrics, status badges, governance, and compliance evidence.', icon: <IconShieldCheck size={21} /> },
      ]}
    />
  ),
};
