import type { Meta, StoryObj } from '@storybook/react';
import { NavigationDropdown, Server } from './NavigationDropdown';

const meta: Meta<typeof NavigationDropdown> = {
  component: NavigationDropdown,
  title: 'reusable/NavigationDropdown',
};

export default meta;
type Story = StoryObj<typeof NavigationDropdown>;

export const Primary: Story = {
  args: {
    trigger: (
      <Server
        id="1"
        name="Server 1"
        status="active"
        url="http://localhost:3000"
      />
    ),
    servers: [
      {
        id: '1',
        name: 'Server 1',
        status: 'active',
        url: 'http://localhost:3000',
      },
      {
        id: '2',
        name: 'Server 2',
        status: 'processing',
        url: 'http://localhost:3000',
      },
      {
        id: '3',
        name: 'Server 3',
        status: 'inactive',
        url: 'http://localhost:3000',
      },
    ],
  },
};
