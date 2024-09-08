import type { Meta, StoryObj } from '@storybook/react';
import { ADEHeader } from './ADEHeader';

const meta: Meta<typeof ADEHeader> = {
  component: ADEHeader,
  title: 'ade/ADEHeader',
};

export default meta;
type Story = StoryObj<typeof ADEHeader>;

export const Primary: Story = {};
