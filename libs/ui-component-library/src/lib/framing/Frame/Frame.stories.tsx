import type { Meta, StoryObj } from '@storybook/react';
import { Frame } from './Frame';

const meta: Meta<typeof Frame> = {
  component: Frame,
  title: 'Framing/Frame',
};

export default meta;
type Story = StoryObj<typeof Frame>;

export const Primary: Story = {
  args: {
    children: 'I am a frame, I am used to scaffolding things',
    padding: 'xxsmall',
    border: false,
  },
  argTypes: {
    color: {
      options: [
        'background',
        'background-grey',
        'background-grey2',
        'background-black',
      ],
      control: { type: 'radio' },
    },
    padding: {
      options: ['xxsmall', 'xsmall', 'small', 'true'],
      control: { type: 'radio' },
    },
    border: {
      control: { type: 'boolean' },
    },
    rounded: {
      control: { type: 'boolean' },
    },
  },
};
