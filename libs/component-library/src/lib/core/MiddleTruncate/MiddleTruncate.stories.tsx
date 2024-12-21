import type { Meta, StoryObj } from '@storybook/react';
import { MiddleTruncate } from './MiddleTruncate';

const meta: Meta<typeof MiddleTruncate> = {
  component: MiddleTruncate,
  title: 'core/MiddleTruncate',
};

export default meta;
type Story = StoryObj<typeof MiddleTruncate>;

export const Primary: Story = {};
