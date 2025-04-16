import type { Meta, StoryObj } from '@storybook/react';
import { InlineTextDiff } from './InlineTextDiff';

const meta: Meta<typeof InlineTextDiff> = {
  component: InlineTextDiff,
  title: 'core/InlineTextDiff',
};

export default meta;
type Story = StoryObj<typeof InlineTextDiff>;

export const Primary: Story = {};
