import type { Meta, StoryObj } from '@storybook/react';
import { CopyButton } from './CopyButton';

const meta: Meta<typeof CopyButton> = {
  component: CopyButton,
  title: 'reusable/CopyButton',
};

export default meta;
type Story = StoryObj<typeof CopyButton>;

export const Primary: Story = {};
