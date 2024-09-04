import type { Meta, StoryObj } from '@storybook/react';
import { PanelItem } from './PanelItem';

const meta: Meta<typeof PanelItem> = {
  component: PanelItem,
  title: 'ade/PanelItem',
};

export default meta;
type Story = StoryObj<typeof PanelItem>;

export const Primary: Story = {};
