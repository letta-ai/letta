import type { Meta, StoryObj } from '@storybook/react';
import { Input } from './Input';
import { generateWrapWithFormContext } from '../../../helpers';

const meta: Meta<typeof Input> = {
  component: Input,
  title: 'Core/Input',
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Primary: Story = {
  args: {
    label: 'Username',
    placeholder: 'Enter your username',
    infoTooltip: {
      text: 'hi',
    },
  },
  decorators: [
    generateWrapWithFormContext({
      alternativeText: 'Use <RawInput /> instead if you dont need the Form',
    }),
  ],
};
