import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<typeof Button> = {
  component: Button,
  title: 'Button',
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary = {
  args: {
    children: 'Hello',
  },
};
