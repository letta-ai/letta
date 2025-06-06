import type { Meta, StoryObj } from '@storybook/react';
import { HotKey } from './HotKey';

const meta: Meta<typeof HotKey> = {
  component: HotKey,
  title: 'core/HotKey',
};

export default meta;
type Story = StoryObj<typeof HotKey>;

export const Primary: Story = {};
