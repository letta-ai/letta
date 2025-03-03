import type { Meta, StoryObj } from '@storybook/react';
import { Logo } from './Logo';

const meta: Meta<typeof Logo> = {
  component: Logo,
  title: 'Marketing/Logo',
};

export default meta;
type Story = StoryObj<typeof Logo>;

export const Primary: Story = {
  argTypes: {
    color: {
      options: ['black', 'white'],
      control: { type: 'radio' },
    },
    size: {
      options: ['default'],
      control: { type: 'radio' },
    },
  },
  decorators: [
    (Story, { args }) => {
      const USE_DARK_BG = args.color === 'black';
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
