import type { Meta, StoryObj } from '@storybook/react';
import { DynamicStack } from './DynamicStack';

const meta: Meta<typeof DynamicStack> = {
  component: DynamicStack,
  title: 'framing/DynamicStack',
};

export default meta;
type Story = StoryObj<typeof DynamicStack>;

export const Primary: Story = {};
