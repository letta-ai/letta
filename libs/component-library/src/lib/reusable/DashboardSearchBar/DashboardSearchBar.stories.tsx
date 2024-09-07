import type { Meta, StoryObj } from '@storybook/react';
import { DashboardSearchBar } from './DashboardSearchBar';

const meta: Meta<typeof DashboardSearchBar> = {
  component: DashboardSearchBar,
  title: 'reusable/DashboardSearchBar',
};

export default meta;
type Story = StoryObj<typeof DashboardSearchBar>;

export const Primary: Story = {};
