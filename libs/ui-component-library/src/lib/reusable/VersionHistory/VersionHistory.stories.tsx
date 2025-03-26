import type { Meta, StoryObj } from '@storybook/react';
import { VersionHistory } from './VersionHistory';

const meta: Meta<typeof VersionHistory> = {
  component: VersionHistory,
  title: 'reusable/VersionHistory',
};

export default meta;
type Story = StoryObj<typeof VersionHistory>;

export const Primary: Story = {
  argTypes: {
    versions: { control: 'object' },
  },
  args: {
    versions: [
      {
        title: 'Version 1',
        message: 'Initial version',
        details: 'Initial version details',
      },
      {
        title: 'Version 2',
        message: 'Second version',
        details: 'Second version details',
        subtitle: '2022-01-02',
      },
      {
        title: 'Superlong version name 293098234842383',
        message: 'Second version',
        details: 'Second version details',
        subtitle: '2022-01-02',
      },
    ],
  },
};
