import type { Meta, StoryObj } from '@storybook/react';
import { SingleFileUpload } from './SingleFileUpload';
import { inputStorybookArgs, inputStorybookArgTypes } from '../Form/Form';
import { generateWrapWithFormContext } from '../../../helpers';

const meta: Meta<typeof SingleFileUpload> = {
  component: SingleFileUpload,
  title: 'core/SingleFileUpload',
};

export default meta;
type Story = StoryObj<typeof SingleFileUpload>;

export const Primary: Story = {
  argTypes: {
    ...inputStorybookArgTypes,
  },
  args: {
    ...inputStorybookArgs,
    label: 'Username',
  },
  decorators: [
    generateWrapWithFormContext({
      alternativeText:
        'Use <RawSingleFileUpload /> instead if you dont need the Form',
    }),
  ],
};
