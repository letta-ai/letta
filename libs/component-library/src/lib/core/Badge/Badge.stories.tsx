import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from './Badge';

const meta: Meta<typeof Badge> = {
  component: Badge,
  title: 'core/Badge',
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Primary: Story = {};
