import type { Meta, StoryObj } from '@storybook/react';
import { OnboardingCheckbox } from './OnboardingCheckbox';
import { LettaCoinIcon } from '../../icons';

const meta: Meta<typeof OnboardingCheckbox> = {
  component: OnboardingCheckbox,
  title: 'onboarding/OnboardingCheckbox',
};

export default meta;
type Story = StoryObj<typeof OnboardingCheckbox>;

export const Primary: Story = {
  args: {
    checked: true,
    label: 'Create your first agent',
    award: (
      <span>
        Reward: <LettaCoinIcon /> 2000 credits
      </span>
    ),
  },
};
