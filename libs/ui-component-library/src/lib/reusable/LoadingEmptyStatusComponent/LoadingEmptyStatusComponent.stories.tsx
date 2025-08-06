import type { Meta, StoryObj } from '@storybook/react';
import { LoadingEmptyStatusComponent } from './LoadingEmptyStatusComponent';

const meta: Meta<typeof LoadingEmptyStatusComponent> = {
  component: LoadingEmptyStatusComponent,
  title: 'reusable/LoadingEmptyStatusComponent',
};

export default meta;
type Story = StoryObj<typeof LoadingEmptyStatusComponent>;

export const Primary: Story = {
  args: {
    isLoading: true,
    emptyMessage: 'Loading...',
  },
};
