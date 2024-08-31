import type { Meta, StoryObj } from '@storybook/react';
import { VStack } from './VStack';
import { Primary as FrameStory } from '../Frame/Frame.stories';

const meta: Meta<typeof VStack> = {
  component: VStack,
  title: 'Framing/VStack',
};

export default meta;
type Story = StoryObj<typeof VStack>;

export const Primary: Story = {
  args: {
    children: (
      <>
        <div>I stack</div>
        <div>vertically</div>
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
