import type { Meta, StoryObj } from '@storybook/react';
import { JSONDiff } from './JSONDiff';

const meta: Meta<typeof JSONDiff> = {
  component: JSONDiff,
  title: 'core/JSONDiff',
};

export default meta;
type Story = StoryObj<typeof JSONDiff>;

export const Primary: Story = {
  args: {
    currentState: {
      name: 'John Doe',
      age: 30,
      address: {
        street: '123 Main St',
        city: 'Anytown',
      },
    },
    nextState: {
      age: 31,
      address: {
        street: '123 Main St',
        city: 'Anytown',
        country: 'USA',
      },
    },
  },
};
