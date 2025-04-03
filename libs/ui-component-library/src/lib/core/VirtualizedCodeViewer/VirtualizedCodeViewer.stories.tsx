import type { Meta, StoryObj } from '@storybook/react';
import { VirtualizedCodeViewer } from './VirtualizedCodeViewer';

const meta: Meta<typeof VirtualizedCodeViewer> = {
  component: VirtualizedCodeViewer,
  title: 'core/VirtualizedCodeViewer',
};

export default meta;
type Story = StoryObj<typeof VirtualizedCodeViewer>;

export const Primary: Story = {
  args: {
    content: new Array(1000).fill('Hello World!').join('\n'),
  },
  decorators: [
    (Story) => (
      <div style={{ width: '500px', height: '500px' }}>
        <Story />
      </div>
    ),
  ],
};
