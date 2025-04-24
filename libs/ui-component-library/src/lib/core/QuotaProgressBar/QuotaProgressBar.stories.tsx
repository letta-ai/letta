import type { Meta, StoryObj } from '@storybook/react';
import { QuotaProgressBar } from './QuotaProgressBar';

const meta: Meta<typeof QuotaProgressBar> = {
  component: QuotaProgressBar,
  title: 'core/QuotaProgressBar',
};

export default meta;
type Story = StoryObj<typeof QuotaProgressBar>;

export const Primary: Story = {
  args: {
    max: 100,
    value: 50,
  },
};

export const Complete: Story = {
  args: {
    max: 100,
    value: 100,
  },
};

export const Infinite: Story = {
  args: {
    max: 'infinite',
    value: 50,
  },
};
