import type { Meta, StoryObj } from '@storybook/react';
import {
  Panel,
  PanelBar,
  PanelManager,
  PanelRenderArea,
  PanelSearch,
} from './Panel';
import { Button } from '../Button/Button';

const meta: Meta<typeof Panel> = {
  component: Panel,
  title: 'Core/Panel',
};
export default meta;
type Story = StoryObj<typeof Panel>;

export const Primary: Story = {
  args: {
    children: (
      <PanelBar actions={[<Button variant="secondary" label="Next" />]}>
        <PanelSearch
          placeholder="Hello"
          onChange={() => {
            return;
          }}
          value=""
        />
      </PanelBar>
    ),
    title: 'asb',
    id: ['fsd'],
    trigger: <button>Click me</button>,
  },
  argTypes: {},
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
