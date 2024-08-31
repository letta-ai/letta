import type { Meta, StoryObj } from '@storybook/react';
import { AccessibilityIcon } from './';

const meta: Meta<typeof AccessibilityIcon> = {
  component: AccessibilityIcon,
  title: 'Core/Icon',
  tags: ['!autodoc'],
};

export default meta;
type Story = StoryObj<typeof AccessibilityIcon>;

export const Primary: Story = {
  tags: ['!autodoc'],
  argTypes: {
    color: {
      options: ['primary', 'default'],
      control: { type: 'radio' },
    },
  },
};
