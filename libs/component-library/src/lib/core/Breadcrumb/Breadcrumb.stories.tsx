import type { Meta, StoryObj } from '@storybook/react';
import { Breadcrumb } from './Breadcrumb';

const meta: Meta<typeof Breadcrumb> = {
  component: Breadcrumb,
  title: 'core/Breadcrumb',
};

export default meta;
type Story = StoryObj<typeof Breadcrumb>;

export const Primary: Story = {};
