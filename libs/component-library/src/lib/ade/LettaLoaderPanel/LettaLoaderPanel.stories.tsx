import type { Meta, StoryObj } from '@storybook/react';
import { LettaLoaderPanel } from './LettaLoaderPanel';
import { PanelForStorybook } from '../_internal/Panel/Panel';

const meta: Meta<typeof LettaLoaderPanel> = {
  component: LettaLoaderPanel,
  title: 'ade/LettaLoaderPanel',
  decorators: [
    (Story) => {
      return (
        <PanelForStorybook title="Panel Bar Demo">
          <Story />
        </PanelForStorybook>
      );
    },
  ],
};

export default meta;
type Story = StoryObj<typeof LettaLoaderPanel>;

export const Primary: Story = {};
