import type { Meta, StoryObj } from '@storybook/react';
import { Switch } from './Switch';
import { generateWrapWithFormContext } from '../../../helpers';

const meta: Meta<typeof Switch> = {
  component: Switch,
  title: 'core/Switch',
};

export default meta;
type Story = StoryObj<typeof Switch>;

export const Primary: Story = {
  decorators: [
    generateWrapWithFormContext({
      alternativeText: 'Use <RawToggle /> instead if you dont need the Form',
    }),
  ],
  argTypes: {
    description: {
      control: {
        type: 'text',
      },
    },
    label: {
      control: {
        type: 'text',
      },
    },
    hideLabel: {
      control: {
        type: 'boolean',
      },
    },
    fullWidth: {
      control: {
        type: 'boolean',
      },
    },
  },
};
