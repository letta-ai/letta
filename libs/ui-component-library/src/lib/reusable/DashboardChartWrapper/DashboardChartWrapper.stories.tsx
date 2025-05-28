import type { Meta, StoryObj } from '@storybook/react';
import { DashboardChartWrapper } from './DashboardChartWrapper';

const meta: Meta<typeof DashboardChartWrapper> = {
  component: DashboardChartWrapper,
  title: 'reusable/DashboardChartWrapper',
};

export default meta;
type Story = StoryObj<typeof DashboardChartWrapper>;

export const Primary: Story = {
  args: {
    children: 'DashboardChartWrapper',
    title: 'Title',
  },
};
