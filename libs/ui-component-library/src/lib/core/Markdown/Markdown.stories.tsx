import type { Meta, StoryObj } from '@storybook/react';
import { Markdown } from './Markdown';

const meta: Meta<typeof Markdown> = {
  component: Markdown,
  title: 'core/Markdown',
};

export default meta;
type Story = StoryObj<typeof Markdown>;

export const Primary: Story = {};
