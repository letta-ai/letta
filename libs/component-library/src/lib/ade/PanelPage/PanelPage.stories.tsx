import type { Meta, StoryObj } from '@storybook/react';
import { PanelPage } from './PanelPage';

const meta: Meta<typeof PanelPage> = {
  component: PanelPage,
  title: 'ade/PanelPage',
};

export default meta;
type Story = StoryObj<typeof PanelPage>;

export const Primary: Story = {};
