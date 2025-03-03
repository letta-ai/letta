import type { Meta, StoryObj } from '@storybook/react';
import { Popover } from './Popover';
import { Button } from '../Button/Button';

const meta: Meta<typeof Popover> = {
  component: Popover,
  title: 'core/Popover',
};

export default meta;
type Story = StoryObj<typeof Popover>;

export const Primary: Story = {
  argTypes: {
    align: {
      control: {
        type: 'select',
        options: ['left', 'center', 'right'],
      },
    },
  },
  args: {
    trigger: <Button label={'Open Popover'} />,
    children: <div>Hello</div>,
  },
};
