import type { Meta, StoryObj } from '@storybook/react';
import {
  OnboardingPrimaryDialog,
  OnboardingPrimaryHeading,
} from './OnboardingPrimaryDialog';
import { Button } from '../../core/Button/Button';
import { HStack } from '../../framing/HStack/HStack';
import { VStack } from '../../framing/VStack/VStack';
import { Badge } from '../../core/Badge/Badge';
import { OnboardingCheckbox } from '../OnboardingCheckbox/OnboardingCheckbox';
import { LettaCoinIcon } from '../../icons';
import { Typography } from '../../core/Typography/Typography';

const meta: Meta<typeof OnboardingPrimaryDialog> = {
  component: OnboardingPrimaryDialog,
  title: 'onboarding/OnboardingPrimaryDialog',
};

export default meta;
type Story = StoryObj<typeof OnboardingPrimaryDialog>;

export const Primary: Story = {
  decorators: [
    (Story) => (
      <VStack className="h-[1000px]">
        <Story />
      </VStack>
    ),
  ],
  args: {
    isOpen: true,
    children: (
      <VStack>
        <OnboardingPrimaryHeading
          badge={
            <HStack>
              <Badge
                variant="info"
                content={
                  <>
                    Reward: <LettaCoinIcon /> 2500 credits
                  </>
                }
              />
              <Badge variant="default" border content="~15 minutes" />
            </HStack>
          }
          title="Learn about Letta"
          description="Welcome to Letta! Take our onboarding to learn about Letta and how to get your agents to deployment."
        ></OnboardingPrimaryHeading>
        <VStack paddingTop gap="medium">
          <HStack>
            <OnboardingCheckbox label="Create an agent" />
          </HStack>
          <HStack>
            <OnboardingCheckbox label="Message an agent" />
          </HStack>
          <HStack>
            <OnboardingCheckbox label="Deploy an agent in development" />
          </HStack>
          <HStack>
            <OnboardingCheckbox label="Convert an agent to template" />
          </HStack>
          <HStack>
            <OnboardingCheckbox label="Deploy an agent to production" />
          </HStack>
        </VStack>
      </VStack>
    ),
    secondaryAction: (
      <HStack paddingLeft="small">
        <Typography bold>Another time</Typography>
      </HStack>
    ),
    primaryAction: <Button size="large" label="Start Quest" />,
  },
};
