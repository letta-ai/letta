import type { Meta, StoryObj } from '@storybook/react';
import { FullScreenDashboardPageLayout } from './FullScreenDashboardPageLayout';

const meta: Meta<typeof FullScreenDashboardPageLayout> = {
  component: FullScreenDashboardPageLayout,
  title: 'reusable/FullScreenDashboardPageLayout',
};

export default meta;
type Story = StoryObj<typeof FullScreenDashboardPageLayout>;

export const Primary: Story = {};
