import type { Meta, StoryObj } from '@storybook/react';
import { ADESidebarButton } from './ADESidebarButton';

const meta: Meta<typeof ADESidebarButton> = {
  component: ADESidebarButton,
  title: 'ade/ADESidebarButton',
};

export default meta;
type Story = StoryObj<typeof ADESidebarButton>;

export const Primary: Story = {};
