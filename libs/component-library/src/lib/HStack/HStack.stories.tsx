import type { Meta, StoryObj } from '@storybook/react';
import { HStack } from './HStack';
import { Primary as FrameStory } from '../Frame/Frame.stories';
const meta: Meta<typeof HStack> = {
  component: HStack,
  title: 'Framing/HStack',
};

export default meta;
type Story = StoryObj<typeof HStack>;

export const Primary: Story = {
  args: {
    children: (
      <>
        <div>I stack</div>
        <div>horizontally</div>
      </>
    ),
  },
  argTypes: {
    gap: {
      options: ['small', 'true'],
      control: { type: 'radio' },
    },
    ...FrameStory.argTypes,
  },
};
