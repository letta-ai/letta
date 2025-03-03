import type { Meta, StoryObj } from '@storybook/react';
import { MarketingButton } from './MarketingButton';

const meta: Meta<typeof MarketingButton> = {
  component: MarketingButton,
  title: 'Marketing/MarketingButton',
};
export default meta;
type Story = StoryObj<typeof MarketingButton>;

export const Primary: Story = {
  args: {
    label: 'Get Started',
  },
  argTypes: {
    variant: {
      options: ['primary', 'secondary'],
      control: { type: 'radio' },
    },
  },
  decorators: [
    (Story, { args }) => {
      const USE_DARK_BG = ['primaryDark', 'secondaryDark'].includes(
        args.variant || 'primaryLight',
      );

      const constructedClass = !USE_DARK_BG
        ? 'p-5 bg-black text-white'
        : 'bg-white text-black';

      return (
        <div className={constructedClass}>
          <Story />
        </div>
      );
    },
  ],
};
