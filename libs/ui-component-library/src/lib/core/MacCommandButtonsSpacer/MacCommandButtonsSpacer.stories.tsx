import type { Meta, StoryObj } from '@storybook/react';
import { MacCommandButtonsSpacer } from './MacCommandButtonsSpacer';

const meta: Meta<typeof MacCommandButtonsSpacer> = {
  component: MacCommandButtonsSpacer,
  title: 'core/MacCommandButtonsSpacer',
};

export default meta;
type Story = StoryObj<typeof MacCommandButtonsSpacer>;

export const Primary: Story = {};
