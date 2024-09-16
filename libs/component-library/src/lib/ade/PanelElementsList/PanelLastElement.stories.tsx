import type { Meta, StoryObj } from '@storybook/react';
import { PanelElementsList } from './PanelElementsList';

const meta: Meta<typeof PanelElementsList> = {
  component: PanelElementsList,
  title: 'ade/PanelExpandedList',
};

export default meta;
type Story = StoryObj<typeof PanelElementsList>;

export const Primary: Story = {};
