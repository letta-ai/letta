import type { Meta, StoryObj } from '@storybook/react';
import { PanelBar } from './PanelBar';
import { For_storybook_use_only__PanelContent } from '../Panel/Panel';
import { Button } from '../../core/Button/Button';

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
          <Button color="secondary" label="Next" />,
          <Button color="secondary" label="Next" />,
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
        // eslint-disable-next-line react/jsx-pascal-case
        <For_storybook_use_only__PanelContent title="Panel">
          <Story />
        </For_storybook_use_only__PanelContent>
      );
    },
  ],
};
