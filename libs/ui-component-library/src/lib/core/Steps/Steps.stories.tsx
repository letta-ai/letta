import type { Meta, StoryObj } from '@storybook/react';
import { Steps } from './Steps';

const meta: Meta<typeof Steps> = {
  component: Steps,
  title: 'core/Steps',
};

export default meta;
type Story = StoryObj<typeof Steps>;

export const Primary: Story = {
  args: {
    steps: [<div>Step 1</div>, <div>Step 2</div>],
    currentStep: 0,
  },
  argTypes: {
    steps: {
      control: {
        type: 'object',
      },
    },
    currentStep: {
      control: {
        type: 'number',
      },
    },
  },
};
