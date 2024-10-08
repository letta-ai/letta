import type { Meta, StoryObj } from '@storybook/react';
import { RawADETextArea } from './ADETextArea';
import { PanelForStorybook } from '../_internal/Panel/Panel';
import { inputStorybookArgTypes } from '../../core/Form/Form';

const meta: Meta<typeof RawADETextArea> = {
  component: RawADETextArea,
  title: 'ade/ADETextArea',
  argTypes: {
    ...inputStorybookArgTypes,
    placeholder: {
      control: {
        type: 'text',
      },
    },
  },
  decorators: [
    (Story) => {
      return (
        <PanelForStorybook title="Input Demo">
          <Story />
        </PanelForStorybook>
      );
    },
  ],
};

export default meta;
type Story = StoryObj<typeof RawADETextArea>;

export const Primary: Story = {};
