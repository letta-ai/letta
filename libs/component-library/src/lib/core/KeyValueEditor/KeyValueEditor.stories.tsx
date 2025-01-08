import type { Meta, StoryObj } from '@storybook/react';
import { KeyValueEditor } from './KeyValueEditor';
import { generateWrapWithFormContext } from '../../../helpers';

const meta: Meta<typeof KeyValueEditor> = {
  component: KeyValueEditor,
  title: 'core/KeyValueEditor',
};

export default meta;
type Story = StoryObj<typeof KeyValueEditor>;

export const Primary: Story = {
  decorators: [
    generateWrapWithFormContext({
      alternativeText:
        'Use <RawKeyValueEditor /> instead if you dont need the Form',
    }),
  ],
};
