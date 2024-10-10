import type { Meta, StoryObj } from '@storybook/react';
import { TextArea } from './TextArea';
import { generateWrapWithFormContext } from '../../../helpers';
import { inputStorybookArgs, inputStorybookArgTypes } from '../Form/Form';

const meta: Meta<typeof TextArea> = {
  component: TextArea,
  title: 'core/TextArea',
};

export default meta;
type Story = StoryObj<typeof TextArea>;

export const Primary: Story = {
  argTypes: {
    ...inputStorybookArgTypes,
  },
  args: {
    ...inputStorybookArgs,
    label: 'Username',
    placeholder: 'Enter your username',
  },
  decorators: [
    generateWrapWithFormContext({
      alternativeText: 'Use <RawTextArea /> instead if you dont need the Form',
    }),
  ],
};
