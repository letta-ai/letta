import type { Meta, StoryObj } from '@storybook/react';
import { CondensedDashboardPage } from './CondensedDashboardPage';

const meta: Meta<typeof CondensedDashboardPage> = {
  component: CondensedDashboardPage,
  title: 'reusable/CondensedDashboardPage',
};

export default meta;
type Story = StoryObj<typeof CondensedDashboardPage>;

export const Primary: Story = {};
