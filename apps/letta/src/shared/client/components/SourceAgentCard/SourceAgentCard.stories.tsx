import type { Meta, StoryObj } from '@storybook/react';
import { SourceAgentCard } from './SourceAgentCard';

const meta: Meta<typeof SourceAgentCard> = {
  component: SourceAgentCard,
  title: 'reusable/SourceAgentCard',
};

export default meta;
type Story = StoryObj<typeof SourceAgentCard>;

export const Primary: Story = {};
