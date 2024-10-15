import type { Meta, StoryObj } from '@storybook/react';
import { ProgressBar } from './ProgressBar';

const meta: Meta<typeof ProgressBar> = {
  component: ProgressBar,
  title: 'core/ProgressBar',
};

export default meta;
type Story = StoryObj<typeof ProgressBar>;

export const Primary: Story = {};
