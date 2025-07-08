import type { Meta, StoryObj } from '@storybook/react';
import { JSONViewer } from './JSONViewer';

const meta: Meta<typeof JSONViewer> = {
  component: JSONViewer,
  title: 'core/JSONViewer',
};

export default meta;
type Story = StoryObj<typeof JSONViewer>;

export const Primary: Story = {
  args: {
    data: {
      name: 'John Doe',
      age: 30,
      address: {
        street: '123 Main St',
        city: 'Anytown',
      },
    },
  },
};
