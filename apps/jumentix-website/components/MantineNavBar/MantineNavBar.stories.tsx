import type { Meta, StoryObj } from '@storybook/nextjs';
import { MantineNavBar } from './MantineNavBar';

const meta = {
  title: 'Documentation/Shell Navigation',
  component: MantineNavBar,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof MantineNavBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Portuguese: Story = {
  parameters: {
    nextjs: {
      navigation: {
        pathname: '/docs/pt-BR/jumentix/guides/rest-api',
      },
    },
  },
};

export const Mobile: Story = {
  globals: {
    viewport: { value: 'mobile1', isRotated: false },
  },
};
