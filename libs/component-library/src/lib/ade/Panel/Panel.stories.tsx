import type { Meta, StoryObj } from '@storybook/react';
import { Panel, PanelManager, PanelRenderArea } from './Panel';
import { Button } from '../../core/Button/Button';
import React from 'react';

const meta: Meta<typeof Panel> = {
  component: Panel,
  title: 'ADE/Panel',
};
export default meta;
type Story = StoryObj<typeof Panel>;

export const Primary: Story = {
  args: {
    children: 'Hello',
    defaultOpen: true,
    id: ['fsd'],
    trigger: <Button label="Pannel Trigger" />,
  },
  argTypes: {
    children: {
      type: 'string',
    },
  },
  decorators: [
    (Story) => {
      return (
        <PanelManager>
          <PanelRenderArea />
          <Story />
        </PanelManager>
      );
    },
  ],
};
