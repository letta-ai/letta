import type { Meta, StoryObj } from '@storybook/react';
import { CrossedOut } from './CrossedOut';

const meta: Meta<typeof CrossedOut> = {
  component: CrossedOut,
  title: 'reusable/CrossedOut',
};

export default meta;
type Story = StoryObj<typeof CrossedOut>;

export const Primary: Story = {};
