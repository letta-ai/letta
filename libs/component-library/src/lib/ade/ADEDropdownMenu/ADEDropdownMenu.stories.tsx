import type { Meta, StoryObj } from '@storybook/react';
import { ADEDropdownMenu } from './ADEDropdownMenu';

const meta: Meta<typeof ADEDropdownMenu> = {
  component: ADEDropdownMenu,
  title: 'ade/ADEDropdownMenu',
};

export default meta;
type Story = StoryObj<typeof ADEDropdownMenu>;

export const Primary: Story = {};
