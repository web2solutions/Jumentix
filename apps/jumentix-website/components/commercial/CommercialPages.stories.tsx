import type { Meta, StoryObj } from '@storybook/nextjs';
import { CommercialPage, CommercialUseCasePage } from './CommercialPages';

const meta = {
  title: 'Commercial/Pages',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Home: Story = {
  render: () => <CommercialPage page="home" />,
};

export const HomePortuguese: Story = {
  render: () => <CommercialPage locale="pt-BR" page="home" />,
};

export const Product: Story = {
  render: () => <CommercialPage page="product" />,
};

export const UseCases: Story = {
  render: () => <CommercialPage page="use-cases" />,
};

export const Integrations: Story = {
  render: () => <CommercialPage page="integrations" />,
};

export const Architecture: Story = {
  render: () => <CommercialPage page="architecture" />,
};

export const Security: Story = {
  render: () => <CommercialPage page="security" />,
};

export const Community: Story = {
  render: () => <CommercialPage page="community" />,
};

export const Roadmap: Story = {
  render: () => <CommercialPage page="roadmap" />,
};

export const RestApiJourney: Story = {
  render: () => <CommercialUseCasePage locale="en" name="rest-api" />,
};

export const RealtimeJourney: Story = {
  render: () => <CommercialUseCasePage locale="en" name="realtime-api" />,
};

export const MobileProduct: Story = {
  globals: {
    viewport: { value: 'mobile1', isRotated: false },
  },
  render: () => <CommercialPage page="product" />,
};
