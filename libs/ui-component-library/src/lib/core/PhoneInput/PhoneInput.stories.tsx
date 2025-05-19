import type { Meta, StoryObj } from '@storybook/react';
import { PhoneInput } from './PhoneInput';

const meta: Meta<typeof PhoneInput> = {
  component: PhoneInput,
  title: 'core/PhoneInput',
};

export default meta;
type Story = StoryObj<typeof PhoneInput>;

export const Primary: Story = {};
