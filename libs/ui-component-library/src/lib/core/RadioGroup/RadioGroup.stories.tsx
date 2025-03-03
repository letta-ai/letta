import type { Meta, StoryObj } from '@storybook/react';
import { RadioGroup } from './RadioGroup';
import { generateWrapWithFormContext } from '../../../helpers';

const meta: Meta<typeof RadioGroup> = {
  component: RadioGroup,
  title: 'core/RadioGroup',
};

export default meta;
type Story = StoryObj<typeof RadioGroup>;

export const Primary: Story = {
  argTypes: {
    variant: {
      options: ['blocky', 'default'],
      control: { type: 'radio' },
    },
    items: {
      control: { type: 'object' },
    },
  },
  args: {
    items: [
      {
        label: (
          <div className="flex items-center gap-1">
            <div>10,000</div>
            <div className="text-sm text-text-lighter">credits</div>
          </div>
        ),
        value: '10',
        detail: '$10',
      },
      { label: 'Option 2', value: 'option2' },
    ],
    variant: 'blocky',
    fullWidth: true,
  },
  decorators: [
    generateWrapWithFormContext({
      alternativeText:
        'Use <RawRadioGroup /> instead if you dont need the Form',
    }),
  ],
};
