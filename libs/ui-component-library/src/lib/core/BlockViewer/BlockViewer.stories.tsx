import type { Meta, StoryObj } from '@storybook/react';
import { BlockViewer } from './BlockViewer';

const meta: Meta<typeof BlockViewer> = {
  component: BlockViewer,
  title: 'core/BlockViewer',
};

export default meta;
type Story = StoryObj<typeof BlockViewer>;

export const Primary: Story = {};
