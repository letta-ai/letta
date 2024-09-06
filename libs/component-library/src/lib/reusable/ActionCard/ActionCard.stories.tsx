import type { Meta, StoryObj } from '@storybook/react';
import { ActionCard } from './ActionCard';

const meta: Meta<typeof ActionCard> = {
  component: ActionCard,
  title: 'reusable/ActionCard',
};

export default meta;
type Story = StoryObj<typeof ActionCard>;

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
