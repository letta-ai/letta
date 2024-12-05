import type { Meta, StoryObj } from '@storybook/react';
import { ChipSelect } from './ChipSelect';
import { generateWrapWithFormContext } from '../../../helpers';

const meta: Meta<typeof ChipSelect> = {
  component: ChipSelect,
  title: 'core/ChipSelect',
};

export default meta;
type Story = StoryObj<typeof ChipSelect>;

export const Primary: Story = {
  args: {
    label: 'Pick your favorite',
    options: [
      {
        label: 'Option 1',
        value: 'option1',
      },
      {
        label: 'Option 2',
        value: 'option2',
      },
    ],
  },
  decorators: [
    generateWrapWithFormContext({
      alternativeText:
        'Use <RawChipSelect /> instead if you dont need the Form',
    }),
  ],
};
