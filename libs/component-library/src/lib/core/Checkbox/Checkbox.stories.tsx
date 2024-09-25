import type { Meta, StoryObj } from '@storybook/react';
import { CheckboxBase } from './Checkbox';

const meta: Meta<typeof CheckboxBase> = {
  component: CheckboxBase,
  title: 'core/Checkbox',
};

export default meta;
type Story = StoryObj<typeof CheckboxBase>;

export const Primary: Story = {};
