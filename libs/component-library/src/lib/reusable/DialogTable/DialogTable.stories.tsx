import type { Meta, StoryObj } from '@storybook/react';
import { DialogTable } from './DialogTable';

const meta: Meta<typeof DialogTable> = {
  component: DialogTable,
  title: 'reusable/DialogTable',
};

export default meta;
type Story = StoryObj<typeof DialogTable>;

export const Primary: Story = {};
