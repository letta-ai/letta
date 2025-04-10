import type { Meta, StoryObj } from '@storybook/react';
import { VariableInput } from './VariableInput';

const meta: Meta<typeof VariableInput> = {
  component: VariableInput,
  title: 'core/VariableInput',
};

export default meta;
type Story = StoryObj<typeof VariableInput>;

export const Primary: Story = {
  args: {
    value: {
      key: 'test',
      value: 'test',
      scope: 'agent',
    },
    onValueChange: (value) => {
      console.log(value);
    },
    overriddenValues: [],
  },
};

export const WithOverriddenValues: Story = {
  args: {
    value: {
      key: 'test',
      value: 'test',
      scope: 'agent',
    },
    onValueChange: (value) => {
      console.log(value);
    },
    overriddenValues: [
      {
        value: 'test',
        scope: 'global',
      },
    ],
  },
};

export const WithDelete: Story = {
  args: {
    canDelete: true,
    value: {
      key: 'test',
      value: 'test',
      scope: 'agent',
    },
    onValueChange: (value) => {
      console.log(value);
    },
  },
};
