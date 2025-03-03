import type { Meta, StoryObj } from '@storybook/react';
import { HR } from './HR';

const meta: Meta<typeof HR> = {
  component: HR,
  title: 'core/HR',
};

export default meta;
type Story = StoryObj<typeof HR>;

export const Primary: Story = {};
