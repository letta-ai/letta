import type { Meta, StoryObj } from '@storybook/react';
import { LettaLoader } from './LettaLoader';

const meta: Meta<typeof LettaLoader> = {
  component: LettaLoader,
  title: 'core/LettaLoader',
};

export default meta;
type Story = StoryObj<typeof LettaLoader>;

export const Primary: Story = {
  args: {
    size: 'xlarge',
  },
  argTypes: {
    variant: {
      options: ['grower', 'spinner'],
      control: { type: 'radio' },
    },
    size: {
      options: ['small', 'medium', 'default', 'large', 'xlarge'],
      control: { type: 'radio' },
    },
  },
};
