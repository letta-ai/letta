import type { Meta, StoryObj } from '@storybook/react';
import { DashboardLoader } from './DashboardLoader';

const meta: Meta<typeof DashboardLoader> = {
  component: DashboardLoader,
  title: 'reusable/DashboardLoader',
};

export default meta;
type Story = StoryObj<typeof DashboardLoader>;

export const Primary: Story = {};
