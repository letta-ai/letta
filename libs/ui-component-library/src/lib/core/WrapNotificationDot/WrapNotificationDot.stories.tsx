import type { Meta, StoryObj } from '@storybook/react';
import { WrapNotificationDot } from './WrapNotificationDot';

const meta: Meta<typeof WrapNotificationDot> = {
  component: WrapNotificationDot,
  title: 'core/WrapNotificationDot',
};

export default meta;
type Story = StoryObj<typeof WrapNotificationDot>;

export const Primary: Story = {};
