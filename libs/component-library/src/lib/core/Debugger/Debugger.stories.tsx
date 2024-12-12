import type { Meta, StoryObj } from '@storybook/react';
import { Debugger } from './Debugger';
import { TerminalIcon } from '../../icons/';
import { z } from 'zod';

const meta: Meta<typeof Debugger> = {
  component: Debugger,
  title: 'core/Debugger',
};

export default meta;
type Story = StoryObj<typeof Debugger>;

export const Primary: Story = {
  args: {
    inputConfig: {
      schema: z.record(z.string(), z.any()),
      inputLabel: 'Tool Input',
      runLabel: 'Run',
    },
    onRun: (input) => {
      console.log(input);
    },
    preLabelIcon: <TerminalIcon />,
    label: 'Debugger',
  },
};
