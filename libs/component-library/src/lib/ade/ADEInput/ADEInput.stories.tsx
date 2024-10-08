import type { Meta, StoryObj } from '@storybook/react';
import type { ADEInput } from './ADEInput';
import { RawADEInput } from './ADEInput';
import { PanelForStorybook } from '../_internal/Panel/Panel';
import { inputStorybookArgTypes } from '../../core/Form/Form';

const meta: Meta<typeof ADEInput> = {
  component: RawADEInput,
  title: 'ade/ADEInput',
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
type Story = StoryObj<typeof ADEInput>;

export const Primary: Story = {};
