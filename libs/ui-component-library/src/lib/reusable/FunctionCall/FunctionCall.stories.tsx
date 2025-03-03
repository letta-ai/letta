import type { Meta, StoryObj } from '@storybook/react';
import { FunctionCall } from './FunctionCall';

const meta: Meta<typeof FunctionCall> = {
  component: FunctionCall,
  title: 'reusable/FunctionCall',
};

export default meta;
type Story = StoryObj<typeof FunctionCall>;

export const Primary: Story = {};
