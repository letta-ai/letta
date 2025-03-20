import type { Meta, StoryObj } from '@storybook/react';
import { PackageInstallerView } from './PackageInstallerView';

const meta: Meta<typeof PackageInstallerView> = {
  component: PackageInstallerView,
  title: 'reusable/PackageInstallerView',
};

export default meta;
type Story = StoryObj<typeof PackageInstallerView>;

export const Primary: Story = {
  args: {
    packageNames: ['react', 'react-dom'],
    installers: ['npm', 'yarn'],
  },
};
