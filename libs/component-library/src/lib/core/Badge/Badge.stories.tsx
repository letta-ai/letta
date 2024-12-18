import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from './Badge';

const meta: Meta<typeof Badge> = {
  component: Badge,
  title: 'core/Badge',
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Primary: Story = {
  argTypes: {
    size: {
      options: ['default', 'small'],
      control: { type: 'radio' },
    },
    color: {
      options: [
        'background-grey',
        'background-grey2',
        'background-black',
        'transparent',
        'tertiary',
        'primary',
      ],
      control: { type: 'radio' },
    },
  },
  args: {
    content: 'Badge',
    color: 'background-grey',
    size: 'default',
  },
};
