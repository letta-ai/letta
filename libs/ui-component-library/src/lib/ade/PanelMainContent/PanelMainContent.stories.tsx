import type { Meta, StoryObj } from '@storybook/react';
import { PanelMainContent } from './PanelMainContent';
import { PanelForStorybook } from '../_internal/Panel/Panel';
import { Button } from '../../core/Button/Button';

const meta: Meta<typeof PanelMainContent> = {
  component: PanelMainContent,
  title: 'ade/PanelMainContent',
  decorators: [
    (Story) => {
      return (
        <PanelForStorybook title="Panel Bar Demo">
          <div>Other content</div>
          <Story />
        </PanelForStorybook>
      );
    },
  ],
};

export default meta;
type Story = StoryObj<typeof PanelMainContent>;

export const Primary: Story = {
  args: {
    children: 'Nothing',
  },
  argTypes: {
    children: {
      control: {
        type: 'radio',
      },
      options: ['Scrolling Demo', 'Nothing'],
      mapping: {
        'Scrolling Demo': Array.from({ length: 15 }).map((_, i) => (
          <Button key={i} color="primary" size="small" label={`Button ${i}`} />
        )),
        Nothing: [
          <div key="nothing" className="bg-blue-50 w-full h-full">Panel Main Content</div>,
        ],
      },
    },
  },
};
