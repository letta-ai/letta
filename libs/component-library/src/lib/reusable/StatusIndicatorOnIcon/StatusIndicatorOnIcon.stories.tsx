import type { Meta, StoryObj } from '@storybook/react';
import { StatusIndicatorOnIcon } from './StatusIndicatorOnIcon';

const meta: Meta<typeof StatusIndicatorOnIcon> = {
  component: StatusIndicatorOnIcon,
  title: 'reusable/StatusIndicatorOnIcon',
};

export default meta;
type Story = StoryObj<typeof StatusIndicatorOnIcon>;

export const Primary: Story = {};
