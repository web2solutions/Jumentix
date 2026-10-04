import { HexagonalArchitectureMap } from './HexagonalArchitectureMap';

import type { Meta, StoryObj } from '@storybook/nextjs';

const meta = {
  title: 'Architecture/Hexagonal Map',
  component: HexagonalArchitectureMap,
  tags: ['autodocs'],
  parameters: { layout: 'padded' }
} satisfies Meta<typeof HexagonalArchitectureMap>;

export default meta;
type Story = StoryObj<typeof meta>;

export const English: Story = {
  args: { locale: 'en' }
};

export const Portuguese: Story = {
  args: { locale: 'pt-BR' }
};
