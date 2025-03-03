import type { Meta, StoryObj } from '@storybook/react';
import { DashboardPageSection } from './DashboardPageSection';

const meta: Meta<typeof DashboardPageSection> = {
  component: DashboardPageSection,
  title: 'reusable/DashboardPageSection',
};

export default meta;
type Story = StoryObj<typeof DashboardPageSection>;

export const Primary: Story = {};
