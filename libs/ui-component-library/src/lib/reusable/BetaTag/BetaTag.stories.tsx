import type { Meta, StoryObj } from '@storybook/react';
import { BetaTag } from './BetaTag';

const meta: Meta<typeof BetaTag> = {
  component: BetaTag,
  title: 'reusable/BetaTag',
};

export default meta;
type Story = StoryObj<typeof BetaTag>;

export const Primary: Story = {};
