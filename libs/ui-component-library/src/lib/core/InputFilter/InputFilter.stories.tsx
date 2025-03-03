import type { Meta, StoryObj } from '@storybook/react';
import { InputFilter } from './InputFilter';

const meta: Meta<typeof InputFilter> = {
  component: InputFilter,
  title: 'core/InputFilter',
};

export default meta;
type Story = StoryObj<typeof InputFilter>;

export const Primary: Story = {};
