import type { Meta, StoryObj } from '@storybook/react';
import { SideOverlay } from './SideOverlay';

const meta: Meta<typeof SideOverlay> = {
  component: SideOverlay,
  title: 'core/SideOverlay',
};

export default meta;
type Story = StoryObj<typeof SideOverlay>;

export const Primary: Story = {
  args: {
    trigger: <button>Trigger</button>,
  },
};
