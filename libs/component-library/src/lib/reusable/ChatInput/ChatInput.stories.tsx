import type { Meta, StoryObj } from '@storybook/react';
import { ChatInput } from './ChatInput';

const meta: Meta<typeof ChatInput> = {
  component: ChatInput,
  title: 'reusable/ChatInput',
};

export default meta;
type Story = StoryObj<typeof ChatInput>;

export const Primary: Story = {};
