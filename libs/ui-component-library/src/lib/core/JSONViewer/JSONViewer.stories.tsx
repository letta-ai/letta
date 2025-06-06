import type { Meta, StoryObj } from '@storybook/react';
import { JSONViewer } from './JSONViewer';

const meta: Meta<typeof JSONViewer> = {
  component: JSONViewer,
  title: 'core/JSONViewer',
};

export default meta;
type Story = StoryObj<typeof JSONViewer>;

export const Primary: Story = {};
