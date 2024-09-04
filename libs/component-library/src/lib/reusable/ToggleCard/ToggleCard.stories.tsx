import type { Meta, StoryObj } from '@storybook/react';
import { ToggleCard } from './ToggleCard';

const meta: Meta<typeof ToggleCard> = {
  component: ToggleCard,
  title: 'reusable/ToggleCard',
};

export default meta;
type Story = StoryObj<typeof ToggleCard>;

export const Primary: Story = {
  argTypes: {
    description: {
      control: 'text',
    },
  },
  args: {
    description:
      'TeAct as ANNA (Adaptive Neural Network Assistant), an AI fostering ethical, honest, and trustworthy behavior. xt',
    title: 'Toggle Card',
    subtitle: 'This is a subtitle',
    checked: false,
    onChange: () => {
      return;
    },
    icon: null,
  },
};
