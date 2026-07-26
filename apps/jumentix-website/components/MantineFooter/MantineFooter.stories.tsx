import type { Meta, StoryObj } from '@storybook/nextjs';
import { MantineFooter } from './MantineFooter';

const meta = {
  title: 'Documentation/Shell Footer',
  component: MantineFooter,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof MantineFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Portuguese: Story = {
  parameters: {
    nextjs: {
      navigation: {
        pathname: '/docs/pt-BR/jumentix',
      },
    },
  },
};
