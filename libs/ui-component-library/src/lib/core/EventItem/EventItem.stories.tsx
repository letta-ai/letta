import type { Meta, StoryObj } from '@storybook/react';
import { EventItem } from './EventItem';
import { Typography } from '../Typography/Typography';
import { Button } from '../Button/Button';
import { Badge } from '../Badge/Badge';
import {
  CheckCircleFilledIcon,
  CodeIcon,
  DatabaseIcon,
  FileIcon,
  InfoIcon,
  SendIcon,
  StartIcon,
  UserFaceIcon,
  WarningIcon,
} from '../../icons';

const meta: Meta<typeof EventItem> = {
  component: EventItem,
  title: 'core/EventItem',
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof EventItem>;

export const Default: Story = {
  args: {
    name: 'System Event',
    icon: <InfoIcon />,
  },
};

export const WithRightContent: Story = {
  args: {
    name: 'API Call',
    icon: <SendIcon />,
    rightContent: (
      <Typography variant="body2" color="muted">
        2 minutes ago
      </Typography>
    ),
  },
};

export const WithChildren: Story = {
  args: {
    name: 'Database Query',
    icon: <DatabaseIcon />,
    rightContent: <Badge content="Success" variant="success"></Badge>,
    children: (
      <Typography variant="body2" color="muted">
        SELECT * FROM users WHERE active = true
      </Typography>
    ),
  },
};

export const ComplexContent: Story = {
  args: {
    name: (
      <>
        Function Call
        <Badge content="async" variant="default" size="small"></Badge>
      </>
    ),
    icon: <CodeIcon />,
    rightContent: (
      <>
        <Typography variant="body3" color="muted">
          3.2s
        </Typography>
        <Button label="view details" size="small"></Button>
      </>
    ),
    children: (
      <div
        style={{
          background: 'var(--background-muted)',
          padding: '8px',
          borderRadius: '4px',
          width: '100%',
        }}
      >
        <code style={{ fontSize: '12px', fontFamily: 'monospace' }}>
          await processUserData(userId: "123", options: {`{ validate: true }`})
        </code>
      </div>
    ),
  },
};

export const EventSequence: Story = {
  render: () => (
    <div>
      <EventItem
        name="User Login"
        icon={<UserFaceIcon />}
        rightContent={
          <Typography variant="body2" color="muted">
            10:32 AM
          </Typography>
        }
      />
      <EventItem
        name="Authentication Check"
        icon={<CheckCircleFilledIcon />}
        rightContent={<Badge variant="success">Verified</Badge>}
      />
      <EventItem
        name="Load User Profile"
        icon={<DatabaseIcon />}
        rightContent={
          <Typography variant="body2" color="muted">
            125ms
          </Typography>
        }
      >
        <Typography variant="body2" color="muted">
          Fetched user preferences and settings
        </Typography>
      </EventItem>
      <EventItem
        name="Initialize Session"
        icon={<StartIcon />}
        rightContent={
          <Typography variant="body2" color="muted">
            10:32 AM
          </Typography>
        }
      />
    </div>
  ),
};

export const ErrorState: Story = {
  args: {
    name: 'API Request Failed',
    icon: <WarningIcon />,
    rightContent: <Badge content="Error" variant="destructive"></Badge>,
    children: (
      <div style={{ color: 'var(--destructive)', fontSize: '14px' }}>
        Connection timeout: Unable to reach server at api.example.com
      </div>
    ),
  },
};

export const WithLongContent: Story = {
  args: {
    name: 'Document Analysis',
    icon: <FileIcon />,
    rightContent: (
      <>
        <Typography variant="body2" color="muted">
          5 pages
        </Typography>
        <Button label="Expand" size="small">
          Expand
        </Button>
      </>
    ),
    children: (
      <Typography variant="body2" color="muted">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod
        tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
        veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea
        commodo consequat.
      </Typography>
    ),
  },
};

export const MultipleActions: Story = {
  args: {
    name: 'Memory Update',
    icon: <DatabaseIcon />,
    rightContent: (
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <Button label="Undo" size="small"></Button>
        <Button label="View" size="small"></Button>
        <Typography variant="body2" color="muted">
          Just now
        </Typography>
      </div>
    ),
    children: (
      <Typography variant="body2" color="muted">
        Updated conversation context with new information about user preferences
      </Typography>
    ),
  },
};
