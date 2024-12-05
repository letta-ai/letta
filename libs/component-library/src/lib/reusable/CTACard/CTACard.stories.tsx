import type { Meta, StoryObj } from '@storybook/react';
import { CTACard } from './CTACard';

const meta: Meta<typeof CTACard> = {
  component: CTACard,
  title: 'reusable/CTACard',
};

export default meta;
type Story = StoryObj<typeof CTACard>;

export const Primary: Story = {};
