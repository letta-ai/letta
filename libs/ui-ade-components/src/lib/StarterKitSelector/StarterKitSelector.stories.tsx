import type { Meta, StoryObj } from '@storybook/react';
import { StarterKitSelector } from './StarterKitSelector';

const meta: Meta<typeof StarterKitSelector> = {
  component: StarterKitSelector,
  title: 'reusable/StarterKitSelector',
};

export default meta;
type Story = StoryObj<typeof StarterKitSelector>;

export const Primary: Story = {};
