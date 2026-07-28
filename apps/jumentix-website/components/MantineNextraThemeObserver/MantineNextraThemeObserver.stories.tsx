import type { Meta, StoryObj } from '@storybook/nextjs';
import { Text } from '@mantine/core';
import { MantineNextraThemeObserver } from './MantineNextraThemeObserver';

const meta = {
  title: 'Legacy Shell/Nextra Theme Observer',
  component: MantineNextraThemeObserver,
  tags: ['autodocs'],
} satisfies Meta<typeof MantineNextraThemeObserver>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SynchronizedTheme: Story = {
  render: () => (
    <>
      <MantineNextraThemeObserver />
      <Text>The observer keeps the Nextra and Mantine color schemes synchronized.</Text>
    </>
  ),
};
