import type { Meta, StoryObj } from '@storybook/react';
import { PanelBar } from './PanelBar';
import { Button } from '../../core/Button/Button';
import { PanelForStorybook } from '../_internal/Panel/Panel';

const meta: Meta<typeof PanelBar> = {
  component: PanelBar,
  title: 'ADE/PanelBar',
};

export default meta;
type Story = StoryObj<typeof PanelBar>;

export const Primary: Story = {
  args: {
    children: 'Empty',
  },
  argTypes: {
    onReturn: {
      description: 'Pass a function to render a return button',
      control: 'boolean',
      mapping: {
        true: () => {
          return () => {
            return;
          };
        },
        false: undefined,
      },
    },
    actions: {
      control: {
        type: 'radio',
      },
      options: ['With Buttons', 'No Buttons'],
      mapping: {
        'With Buttons': [
          <Button key="button1" color="primary" size="small" label="Next" />,
          <Button key="button2" color="primary" size="small" label="Next" />,
        ],
        'No Buttons': [],
      },
    },
    onSearch: {
      description: 'Pass a function to render a search bar',
      control: 'boolean',
      mapping: {
        true: () => {
          return () => {
            return;
          };
        },
        false: undefined,
      },
    },
  },
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
