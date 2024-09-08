import type { Meta, StoryObj } from '@storybook/react';
import { DashboardStatusComponent } from './DashboardStatusComponent';

const meta: Meta<typeof DashboardStatusComponent> = {
  component: DashboardStatusComponent,
  title: 'reusable/DashboardLoader',
};

export default meta;
type Story = StoryObj<typeof DashboardStatusComponent>;

export const Primary: Story = {};
