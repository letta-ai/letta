import type { Meta, StoryObj } from '@storybook/react';
import { Avatar } from './Avatar';

const meta: Meta<typeof Avatar> = {
  component: Avatar,
  title: 'core/Avatar',
};

export default meta;
type Story = StoryObj<typeof Avatar>;

export const Primary: Story = {
  argTypes: {
    name: {
      control: 'text',
    },
  },
};
