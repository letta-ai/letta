import type { Meta, StoryObj } from '@storybook/react';
import { VR } from './VR';

const meta: Meta<typeof VR> = {
  component: VR,
  title: 'core/VR',
};

export default meta;
type Story = StoryObj<typeof VR>;

export const Primary: Story = {};
