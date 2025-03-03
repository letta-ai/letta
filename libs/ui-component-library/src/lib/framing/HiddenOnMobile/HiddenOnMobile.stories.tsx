import type { Meta, StoryObj } from '@storybook/react';
import { HiddenOnMobile } from './HiddenOnMobile';

const meta: Meta<typeof HiddenOnMobile> = {
  component: HiddenOnMobile,
  title: 'framing/HiddenOnMobile',
};

export default meta;
type Story = StoryObj<typeof HiddenOnMobile>;

export const Primary: Story = {};
