import type { Meta, StoryObj } from '@storybook/react';
import { OnboardingSteps } from './OnboardingSteps';

const meta: Meta<typeof OnboardingSteps> = {
  component: OnboardingSteps,
  title: 'onboarding/OnboardingSteps',
};

export default meta;
type Story = StoryObj<typeof OnboardingSteps>;

export const Primary: Story = {
  args: {
    currentStep: 2,
    totalSteps: 3,
  },
};
