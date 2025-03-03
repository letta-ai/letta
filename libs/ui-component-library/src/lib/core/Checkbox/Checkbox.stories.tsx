import type { Meta, StoryObj } from '@storybook/react';
import { Checkbox } from './Checkbox';
import { generateWrapWithFormContext } from '../../../helpers';
import { inputStorybookArgs, inputStorybookArgTypes } from '../Form/Form';

const meta: Meta<typeof Checkbox> = {
  component: Checkbox,
  title: 'core/Checkbox',
};

export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Primary: Story = {
  args: {
    checked: false,
    ...inputStorybookArgs,
    label: 'check me!',
  },

  argTypes: {
    ...inputStorybookArgTypes,
    checked: {
      control: 'boolean',
    },
  },
  decorators: [
    generateWrapWithFormContext({
      alternativeText: 'Use <RawCheckbox /> instead if you dont need the Form',
    }),
  ],
};
