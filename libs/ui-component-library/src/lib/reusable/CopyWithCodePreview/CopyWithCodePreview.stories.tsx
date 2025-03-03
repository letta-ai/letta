import type { Meta, StoryObj } from '@storybook/react';
import { CopyWithCodePreview } from './CopyWithCodePreview';

const meta: Meta<typeof CopyWithCodePreview> = {
  component: CopyWithCodePreview,
  title: 'reusable/CopyWithCodePreview',
};

export default meta;
type Story = StoryObj<typeof CopyWithCodePreview>;

export const Primary: Story = {
  args: {
    code: 'curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"',
    language: 'bash',
  },
};
