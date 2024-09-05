import type { Meta, StoryObj } from '@storybook/react';
import { PanelExpandedList } from './PanelExpandedList';

const meta: Meta<typeof PanelExpandedList> = {
  component: PanelExpandedList,
  title: 'ade/PanelExpandedList',
};

export default meta;
type Story = StoryObj<typeof PanelExpandedList>;

export const Primary: Story = {};
