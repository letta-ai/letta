import type { Meta, StoryObj } from '@storybook/react';
import { MultiFileUpload } from './MultiFileUpload';
import { inputStorybookArgs, inputStorybookArgTypes } from '../Form/Form';
import { generateWrapWithFormContext } from '../../../helpers';

const meta: Meta<typeof MultiFileUpload> = {
  component: MultiFileUpload,
  title: 'core/MultiFileUpload',
};

export default meta;
type Story = StoryObj<typeof MultiFileUpload>;

export const Primary: Story = {
  argTypes: {
    ...inputStorybookArgTypes,
    maxFiles: {
      control: { type: 'number' },
      description: 'Maximum number of files allowed',
    },
    accept: {
      control: { type: 'text' },
      description: 'Accepted file types',
    },
  },
  args: {
    ...inputStorybookArgs,
    label: 'Upload Files',
    accept: '.txt,.pdf,.json,.md',
  },
  decorators: [
    generateWrapWithFormContext({
      alternativeText:
        'Use <RawMultiFileUpload /> instead if you dont need the Form',
    }),
  ],
};
