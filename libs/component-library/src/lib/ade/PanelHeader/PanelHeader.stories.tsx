import type { Meta, StoryObj } from '@storybook/react';
import { PanelHeader } from './PanelHeader';

const meta: Meta<typeof PanelHeader> = {
  component: PanelHeader,
  title: 'ade/PanelHeader',
};

export default meta;
type Story = StoryObj<typeof PanelHeader>;

export const Primary: Story = {};
