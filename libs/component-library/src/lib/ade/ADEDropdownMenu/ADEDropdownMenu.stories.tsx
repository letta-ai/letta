import type { Meta, StoryObj } from '@storybook/react';
import { ADEDropdownMenu } from './ADEDropdownMenu';
import { Button } from '../../core/Button/Button';

const meta: Meta<typeof ADEDropdownMenu> = {
  component: ADEDropdownMenu,
  title: 'ade/Structural/ADEDropdownMenu',
};

export default meta;
type Story = StoryObj<typeof ADEDropdownMenu>;

export const Primary: Story = {
  argTypes: {
    items: {
      control: {
        type: 'object',
      },
    },
    trigger: {
      control: {
        disable: true,
      },
      description: 'The trigger element that will activate the dropdown',
    },
  },
  args: {
    trigger: <Button label="Activate dropdown" />,
    items: [
      {
        label: 'Item 1',
        onClick: () => {
          console.log('Item 1 clicked');
        },
      },
      {
        label: 'Item 2',
        onClick: () => {
          console.log('Item 2 clicked');
        },
      },
    ],
  },
};
