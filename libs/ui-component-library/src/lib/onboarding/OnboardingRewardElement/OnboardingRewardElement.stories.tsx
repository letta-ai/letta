import type { Meta, StoryObj } from '@storybook/react';
import { OnboardingRewardElement } from './OnboardingRewardElement';

const meta: Meta<typeof OnboardingRewardElement> = {
  component: OnboardingRewardElement,
  title: 'onboarding/OnboardingRewardElement',
};

export default meta;
type Story = StoryObj<typeof OnboardingRewardElement>;

export const Primary: Story = {};
