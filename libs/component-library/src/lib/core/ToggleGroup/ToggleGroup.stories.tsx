import type { Meta, StoryObj } from '@storybook/react';
import { ToggleGroup } from './ToggleGroup';

const meta: Meta<typeof ToggleGroup> = {
  component: ToggleGroup,
  title: 'core/ToggleGroup',
};

export default meta;
type Story = StoryObj<typeof ToggleGroup>;

export const Primary: Story = {};
