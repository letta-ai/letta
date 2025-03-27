import type { Meta, StoryObj } from '@storybook/react';
import { InteractiveSystemMessage } from './InteractiveSystemMessage';

const meta: Meta<typeof InteractiveSystemMessage> = {
  component: InteractiveSystemMessage,
  title: 'reusable/InteractiveSystemMessage',
};

export default meta;
type Story = StoryObj<typeof InteractiveSystemMessage>;

export const Primary: Story = {};
