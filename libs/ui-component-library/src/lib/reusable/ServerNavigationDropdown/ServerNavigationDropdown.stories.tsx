import type { Meta, StoryObj } from '@storybook/react';
import { ServerNavigationDropdown } from './ServerNavigationDropdown';
import { StatusIndicator } from '../../core/StatusIndicator/StatusIndicator';

const meta: Meta<typeof ServerNavigationDropdown> = {
  component: ServerNavigationDropdown,
  title: 'reusable/NavigationDropdown',
};

export default meta;
type Story = StoryObj<typeof ServerNavigationDropdown>;

export const Primary: Story = {
  args: {
    servers: [
      {
        id: '1',
        name: 'Server 1',
        statusIndicator: <StatusIndicator status="active" />,
        url: 'http://localhost:3000',
      },
      {
        id: '2',
        name: 'Server 2',
        statusIndicator: <StatusIndicator status="processing" />,
        url: 'http://localhost:3000',
      },
      {
        id: '3',
        name: 'Server 3',
        statusIndicator: <StatusIndicator status="inactive" />,
        url: 'http://localhost:3000',
      },
    ],
  },
};
