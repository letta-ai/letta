import type { Meta, StoryObj } from '@storybook/react';
import { BlockQuote } from './BlockQuote';

const meta: Meta<typeof BlockQuote> = {
  component: BlockQuote,
  title: 'core/BlockQuote',
};

export default meta;
type Story = StoryObj<typeof BlockQuote>;

export const Primary: Story = {};
