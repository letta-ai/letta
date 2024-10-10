import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
  title: 'Core/Button',
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: {
    label: 'Hello',
    color: 'primary',
    variant: 'default',
    size: 'default',
    fullWidth: false,
    fullHeight: false,
    hideLabel: false,
    active: false,
    busy: false,
    preIcon: '',
    postIcon: '',
    disabled: false,
    tooltipPlacement: 'top',
  },
  argTypes: {
    preIcon: {
      description: 'The icon to display before the button label',
      control: {
        type: 'text',
      },
    },
    disabled: {
      description: 'The disabled state of the button',
      control: {
        type: 'boolean',
      },
    },
    tooltipPlacement: {
      description:
        'The placement of the tooltip, this only is used when the label is hidden',
      options: ['top', 'right', 'bottom', 'left'],
      control: { type: 'radio' },
    },
    postIcon: {
      description: 'The icon to display after the button label',
      control: {
        type: 'text',
      },
    },
    hideLabel: {
      description: 'Hide the button label',
      control: {
        type: 'boolean',
      },
    },
    fullHeight: {
      control: {
        type: 'boolean',
      },
    },
    fullWidth: {
      control: {
        type: 'boolean',
      },
    },
    size: {
      options: ['default', 'small'],
      control: { type: 'radio' },
      description: "Try to stay away from using 'small'",
    },
    active: {
      description:
        'The active state of the button, used when the button is used as a toggle',
      control: {
        type: 'boolean',
      },
    },
    busy: {
      description:
        'The busy state of the button, used when the button is in a loading state',
      control: {
        type: 'boolean',
      },
    },
    variant: {
      options: ['default', 'inline-panel'],
      control: { type: 'radio' },
      description:
        'The button variant, inline-panel is used for buttons in a panel',
    },
    color: {
      options: [
        'primary',
        'secondary',
        'tertiary',
        'destructive',
        'tertiary-transparent',
      ],
      control: { type: 'radio' },
    },
  },
};
