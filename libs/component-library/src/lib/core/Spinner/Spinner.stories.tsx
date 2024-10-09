import type { Meta, StoryObj } from '@storybook/react';
import { Spinner } from './Spinner';

const meta: Meta<typeof Spinner> = {
  component: Spinner,
  title: 'core/Spinner',
};

export default meta;
type Story = StoryObj<typeof Spinner>;

export const Primary: Story = {};
