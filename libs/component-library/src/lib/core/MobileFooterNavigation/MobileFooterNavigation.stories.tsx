import type { Meta, StoryObj } from '@storybook/react';
import { MobileFooterNavigation } from './MobileFooterNavigation';
import { HomeIcon } from '../../icons';

const meta: Meta<typeof MobileFooterNavigation> = {
  component: MobileFooterNavigation,
  title: 'core/MobileFooterNavigation',
};

export default meta;
type Story = StoryObj<typeof MobileFooterNavigation>;

export const Primary: Story = {
  args: {
    items: [
      {
        label: 'Home',
        preIcon: <HomeIcon />,
      },
      {
        label: 'Home',
        preIcon: <HomeIcon />,
      },
      {
        label: 'Home',
        preIcon: <HomeIcon />,
      },
    ],
  },
};
