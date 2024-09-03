import type { Meta, StoryObj } from '@storybook/react';
import { Toggle } from './Toggle';
import { generateWrapWithFormContext } from '../../../helpers';

const meta: Meta<typeof Toggle> = {
  component: Toggle,
  title: 'core/Toggle',
};

export default meta;
type Story = StoryObj<typeof Toggle>;

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
