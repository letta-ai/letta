import type { Meta, StoryObj } from '@storybook/react';
import { InfoTooltip } from './InfoTooltip';

const meta: Meta<typeof InfoTooltip> = {
  component: InfoTooltip,
  title: 'reusable/InfoTooltip',
};

export default meta;
type Story = StoryObj<typeof InfoTooltip>;

export const Primary: Story = {
  args: {
    text: 'This is a tooltip',
  },
  argTypes: {
    text: {
      control: {
        type: 'text',
      },
    },
  },
};
