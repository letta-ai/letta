import type { Meta, StoryObj } from '@storybook/react';
import { ResizableKeyValueEditor } from './ResizableKeyValueEditor';

const meta: Meta<typeof ResizableKeyValueEditor> = {
  component: ResizableKeyValueEditor,
  title: 'core/CondensedResizableVariableInput',
};

export default meta;
type Story = StoryObj<typeof ResizableKeyValueEditor>;

export const Primary: Story = {
  args: {
    definitions: [
      {
        key: 'key1',
        value: 'value1',
        scope: 'agent' as const,
        overriddenValues: [],
      },
      {
        key: 'key2',
        value: 'value2\n\n',
        scope: 'agent' as const,
        overriddenValues: [],
      },
    ],
  },
};
