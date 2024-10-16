import type { Meta, StoryObj } from '@storybook/react';
import { StatusIndicator } from './StatusIndicator';

const meta: Meta<typeof StatusIndicator> = {
  component: StatusIndicator,
  title: 'core/StatusIndicator',
};

export default meta;
type Story = StoryObj<typeof StatusIndicator>;

export const Primary: Story = {};
