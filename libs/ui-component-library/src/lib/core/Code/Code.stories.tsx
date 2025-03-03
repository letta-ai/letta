import type { Meta, StoryObj } from '@storybook/react';
import { Code } from './Code';

const meta: Meta<typeof Code> = {
  component: Code,
  title: 'core/Code',
};

export default meta;
type Story = StoryObj<typeof Code>;

export const Primary: Story = {
  argTypes: {
    language: {
      control: {
        type: 'select',
        options: ['javascript', 'python', 'typescript'],
      },
    },
  },
  args: {
    language: 'python',
    code: `# python code
def hello_world():
  print('Hello, World!')`,
  },
};

export const WithDebugger: Story = {
  argTypes: {
    language: {
      control: {
        type: 'select',
        options: ['javascript', 'python', 'typescript'],
      },
    },
  },
  args: {
    language: 'python',
    code: `# python code
def hello_world():
  print('Hello, World!')`,
  },
};
