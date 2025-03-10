import type { Meta, StoryObj } from '@storybook/react';
import { OnboardingAsideFocus } from './OnboardingAsideFocus';

const meta: Meta<typeof OnboardingAsideFocus> = {
  component: OnboardingAsideFocus,
  title: 'onboarding/OnboardingAsideFocus',
};

export default meta;
type Story = StoryObj<typeof OnboardingAsideFocus>;

export const Primary: Story = {
  args: {
    isOpen: true,
    title: 'Message Agent',
    totalSteps: 4,
    currentStep: 2,
    description:
      'The core functionality of Letta is to send messages to agents, send a message to complete this task.',
    children: <div>Focus on me</div>,
  },
};
