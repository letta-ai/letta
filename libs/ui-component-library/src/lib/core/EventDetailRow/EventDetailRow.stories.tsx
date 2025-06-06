import type { Meta, StoryObj } from '@storybook/react';
import { EventDetailRow } from './EventDetailRow';
import { Typography } from '../Typography/Typography';
import { VStack } from '../../framing/VStack/VStack';
import { HStack } from '../../framing/HStack/HStack';

const meta: Meta<typeof EventDetailRow> = {
  component: EventDetailRow,
  title: 'core/EventDetailRow',
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story) => (
      <div style={{ minWidth: '400px' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof EventDetailRow>;

export const Basic: Story = {
  args: {
    label: 'Event Type:',
    value: 'message_created',
  },
};

export const WithDetails: Story = {
  args: {
    label: 'Status:',
    value: 'Success',
    details: (
      <VStack gap="small">
        <Typography variant="body2">Response time: 142ms</Typography>
        <Typography variant="body2">Status code: 200</Typography>
        <Typography variant="body2">Timestamp: 2024-01-15 10:30:45</Typography>
      </VStack>
    ),
  },
};

export const LongContent: Story = {
  args: {
    label: 'Description:',
    value:
      'This is a very long value that might wrap to multiple lines depending on the container width',
    details: (
      <Typography variant="body2">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod
        tempor incididunt ut labore et dolore magna aliqua.
      </Typography>
    ),
  },
};

export const NestedDetails: Story = {
  args: {
    label: 'Request:',
    value: 'POST /api/messages',
    details: (
      <VStack gap="small">
        <HStack>
          <Typography variant="body2" bold>
            Headers:
          </Typography>
        </HStack>
        <VStack gap="xsmall" padding="xsmall">
          <Typography variant="body2">
            Content-Type: application/json
          </Typography>
          <Typography variant="body2">Authorization: Bearer ****</Typography>
          <Typography variant="body2">X-Request-ID: 12345-67890</Typography>
        </VStack>
        <HStack>
          <Typography variant="body2" bold>
            Body:
          </Typography>
        </HStack>
        <VStack padding="xsmall">
          <pre style={{ margin: 0, fontSize: '12px', fontFamily: 'monospace' }}>
            {`{
  "message": "Hello, world!",
  "timestamp": "2024-01-15T10:30:45Z"
}`}
          </pre>
        </VStack>
      </VStack>
    ),
  },
};

export const MultipleRows: Story = {
  render: () => (
    <VStack gap={false}>
      <EventDetailRow label="Event ID:" value="evt_123456789" />
      <EventDetailRow
        label="Type:"
        value="message_created"
        details={
          <Typography variant="body2">
            Message was created successfully in the conversation
          </Typography>
        }
      />
      <EventDetailRow label="Timestamp:" value="2024-01-15 10:30:45" />
      <EventDetailRow
        label="Status:"
        value="Success"
        details={
          <VStack gap="xsmall">
            <Typography variant="body2">Processing time: 142ms</Typography>
            <Typography variant="body2">Queue time: 5ms</Typography>
          </VStack>
        }
      />
      <EventDetailRow label="User ID:" value="user_987654321" />
    </VStack>
  ),
};

export const ErrorState: Story = {
  args: {
    label: 'Error:',
    value: 'Failed to process request',
    details: (
      <VStack gap="small">
        <Typography variant="body2" color="error">
          Error Code: ERR_INVALID_INPUT
        </Typography>
        <Typography variant="body2">
          The provided input format is not valid. Please check the documentation
          for the correct format.
        </Typography>
        <VStack gap="xsmall" padding="xsmall">
          <Typography variant="body2" bold>
            Stack Trace:
          </Typography>
          <pre
            style={{
              margin: 0,
              fontSize: '11px',
              fontFamily: 'monospace',
              color: '#666',
            }}
          >
            {`at validateInput (validation.js:42)
at processRequest (handler.js:15)
at async handleMessage (app.js:123)`}
          </pre>
        </VStack>
      </VStack>
    ),
  },
};

export const ComplexDetails: Story = {
  args: {
    label: 'Metadata:',
    value: '5 fields',
    details: (
      <VStack gap="small">
        <EventDetailRow label="Created By:" value="system" />
        <EventDetailRow label="Version:" value="1.2.3" />
        <EventDetailRow
          label="Tags:"
          value="production, critical"
          details={
            <VStack gap="xsmall">
              <Typography variant="body2">
                • production - Deployed to production environment
              </Typography>
              <Typography variant="body2">
                • critical - High priority event
              </Typography>
            </VStack>
          }
        />
        <EventDetailRow label="Region:" value="us-west-2" />
        <EventDetailRow label="Instance:" value="i-1234567890abcdef0" />
      </VStack>
    ),
  },
};

export const MinimalPadding: Story = {
  args: {
    label: 'Compact:',
    value: 'Minimal padding example',
  },
  decorators: [
    (Story) => (
      <div style={{ border: '1px solid #ddd', width: 'fit-content' }}>
        <Story />
      </div>
    ),
  ],
};

export const InteractiveExample: Story = {
  render: () => {
    const details = (
      <VStack gap="small">
        <Typography variant="body2">
          Click the row to toggle this detail section. The background color
          changes when expanded.
        </Typography>
        <Typography variant="body2">
          The caret icon on the left indicates whether the section is collapsed
          or expanded.
        </Typography>
      </VStack>
    );

    return (
      <VStack gap="medium">
        <Typography variant="h4">Interactive EventDetailRow</Typography>
        <EventDetailRow
          label="Click me:"
          value="Toggle details"
          details={details}
        />
        <Typography variant="body2" color="secondary">
          Note: Rows without details are not clickable
        </Typography>
        <EventDetailRow label="Static row:" value="No interaction available" />
      </VStack>
    );
  },
};
