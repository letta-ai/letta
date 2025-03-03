import type { Meta, StoryObj } from '@storybook/react';
import { DashboardPageLayout } from './DashboardPageLayout';

const meta: Meta<typeof DashboardPageLayout> = {
  component: DashboardPageLayout,
  title: 'reusable/DashboardPageLayout',
};

export default meta;
type Story = StoryObj<typeof DashboardPageLayout>;

export const Primary: Story = {};
