import type { Meta, StoryObj } from '@storybook/react';
import { Slider } from './Slider';
import { generateWrapWithFormContext } from '../../../helpers';

const meta: Meta<typeof Slider> = {
  component: Slider,
  title: 'core/Slider',
  decorators: [
    generateWrapWithFormContext({
      alternativeText: 'Use <RawSlider /> instead if you dont need the Form',
    }),
  ],
};

export default meta;
type Story = StoryObj<typeof Slider>;

export const Primary: Story = {};
