import type { Meta, StoryObj } from '@storybook/react';
import { SidebarTitle } from './SidebarTitle';

const meta: Meta<typeof SidebarTitle> = {
  component: SidebarTitle,
  title: 'reusable/SidebarTitle',
};

export default meta;
type Story = StoryObj<typeof SidebarTitle>;

export const Primary: Story = {};
