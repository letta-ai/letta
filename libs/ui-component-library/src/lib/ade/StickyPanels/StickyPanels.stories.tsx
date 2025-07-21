import type { Meta, StoryObj } from '@storybook/react';
import { StickyPanels } from './StickyPanels';
import React from 'react';

const meta: Meta<typeof StickyPanels> = {
  component: StickyPanels,
  title: 'ade/StickyPanels',
};

export default meta;
type Story = StoryObj<typeof StickyPanels>;

const examplePanels = [
  {
    id: 'panel1',
    label: 'Panel 1',
    content: <div>Content for Panel 1</div>,
    minHeight: 100,
  },
  {
    id: 'panel2',
    label: 'Panel 2',
    content: <div>Content for Panel 2</div>,
    minHeight: 100,
  },
  {
    id: 'panel3',
    label: 'Panel 3',
    content: <div>Content for Panel 3</div>,
    minHeight: 100,
  },
];

export const Primary: Story = {
  args: {
    panels: examplePanels,
    position: 'top',
    onClick: (id) => {
      console.log(`Clicked on panel with id: ${id}`);
    },
  },
  argTypes: {
    position: {
      control: 'radio',
      options: ['top', 'bottom'],
      description: 'Position of the sticky panels',
    },
    onClick: {
      action: 'clicked',
      description: 'Function called when a panel is clicked',
    },
  },
};
