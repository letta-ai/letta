import type { Meta, StoryObj } from '@storybook/react';
import { Toaster } from './Toaster';

const meta: Meta<typeof Toaster> = {
  component: Toaster,
  title: 'core/Toaster',
};

export default meta;
type Story = StoryObj<typeof Toaster>;

export const Primary: Story = {};
