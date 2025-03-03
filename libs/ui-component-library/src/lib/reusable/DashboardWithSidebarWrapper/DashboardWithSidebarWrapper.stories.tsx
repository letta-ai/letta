import type { Meta, StoryObj } from '@storybook/react';
import { DashboardWithSidebarWrapper } from './DashboardWithSidebarWrapper';

const meta: Meta<typeof DashboardWithSidebarWrapper> = {
  component: DashboardWithSidebarWrapper,
  title: 'reusable/DashboardWithSidebarWrapper',
};

export default meta;
type Story = StoryObj<typeof DashboardWithSidebarWrapper>;

export const Primary: Story = {};
