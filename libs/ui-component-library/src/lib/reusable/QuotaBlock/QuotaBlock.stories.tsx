import type { Meta, StoryObj } from '@storybook/react';
import { QuotaBlock } from './QuotaBlock';

const meta: Meta<typeof QuotaBlock> = {
  component: QuotaBlock,
  title: 'reusable/QuotaBlock',
};

export default meta;
type Story = StoryObj<typeof QuotaBlock>;

export const Primary: Story = {
  args: {
    max: 100,
    value: 50,
    label: 'Premium models requests used',
  },
};
