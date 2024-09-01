import type { Meta, StoryObj } from '@storybook/react';
import { Select } from './Select';
import { generateWrapWithFormContext } from '../../../helpers';

const meta: Meta<typeof Select> = {
  component: Select,
  title: 'core/Select',
};

export default meta;
type Story = StoryObj<typeof Select>;

export const Primary: Story = {
  args: {
    label: 'Select',
  },
  decorators: [
    generateWrapWithFormContext({
      alternativeText: 'Use <RawSelect /> instead if you dont need the Form',
    }),
    (Story) => (
      <div className="h-96">
        <Story />
      </div>
    ),
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
    isMulti: {
      control: {
        type: 'boolean',
      },
    },
    options: {
      control: {
        type: 'select',
      },
      options: ['Normal', 'With Groups'],
      mapping: {
        Normal: [
          { value: '1', label: 'Option 1' },
          { value: '2', label: 'Option 2' },
          { value: '3', label: 'Option 3' },
        ],
        'With Groups': [
          {
            label: 'Group 1',
            options: [
              { value: '1', label: 'Option 1' },
              { value: '2', label: 'Option 2' },
              { value: '3', label: 'Option 3' },
            ],
          },
          {
            label: 'Group 2',
            options: [
              { value: '4', label: 'Option 4' },
              { value: '5', label: 'Option 5' },
            ],
          },
        ],
      },
    },
  },
};
