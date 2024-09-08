import type { Meta, StoryObj } from '@storybook/react';
import { DashboardEmptyArea } from './DashboardEmptyArea';

const meta: Meta<typeof DashboardEmptyArea> = {
  component: DashboardEmptyArea,
  title: 'reusable/DashboardEmptyArea',
};

export default meta;
type Story = StoryObj<typeof DashboardEmptyArea>;

export const Primary: Story = {};
