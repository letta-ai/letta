import type { Meta, StoryObj } from '@storybook/react';
import { JobStatusBadge } from './JobStatusBadge';

const meta: Meta<typeof JobStatusBadge> = {
  component: JobStatusBadge,
  title: 'reusable/JobStatusBadge',
};

export default meta;
type Story = StoryObj<typeof JobStatusBadge>;

export const Primary: Story = {};
