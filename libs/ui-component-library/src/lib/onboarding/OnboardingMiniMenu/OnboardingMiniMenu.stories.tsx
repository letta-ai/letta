import type { Meta, StoryObj } from '@storybook/react';
import { OnboardingMiniMenu } from './OnboardingMiniMenu';

const meta: Meta<typeof OnboardingMiniMenu> = {
  component: OnboardingMiniMenu,
  title: 'onboarding/OnboardingMiniMenu',
};

export default meta;
type Story = StoryObj<typeof OnboardingMiniMenu>;

export const Primary: Story = {};
