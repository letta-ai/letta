import type { Meta, StoryObj } from '@storybook/react';
import { PanelMainContent } from './PanelMainContent';

const meta: Meta<typeof PanelMainContent> = {
  component: PanelMainContent,
  title: 'ade/PanelExpandedList',
};

export default meta;
type Story = StoryObj<typeof PanelMainContent>;

export const Primary: Story = {};
