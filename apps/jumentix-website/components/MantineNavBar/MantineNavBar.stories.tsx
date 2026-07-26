import type { Meta, StoryObj } from '@storybook/nextjs';
import { MantineNavBar } from './MantineNavBar';

const meta = {
  title: 'Legacy Shell/Mantine Navigation',
  component: MantineNavBar,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof MantineNavBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
