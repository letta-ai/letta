import type { Meta, StoryObj } from '@storybook/react';
import { TimelineTrace } from './TimelineTrace';

const meta: Meta<typeof TimelineTrace> = {
  component: TimelineTrace,
  title: 'core/TimelineTrace',
};

export default meta;
type Story = StoryObj<typeof TimelineTrace>;

export const Primary: Story = {
  args: {
    items: [
      {
        event: 'Event 1',
        icon: <span>🔍</span>,
        timestamp: '2023-10-01T12:00:00Z',
        duration: 50000000, // 5 seconds in nanoseconds
        details: <div>Details for Event 1</div>,
      },
      {
        event: 'Event 2',
        icon: <span>⚙️</span>,
        timestamp: '2023-10-01T12:05:00Z',
        duration: 3000000, // 3 seconds in nanoseconds
        details: <div>Details for Event 2</div>,
      },
      {
        event: 'Event 3',
        icon: <span>✅</span>,
        timestamp: '2023-10-01T12:10:00Z',
        duration: 200000, // 2 seconds in nanoseconds
        details: <div>Details for Event 3</div>,
      },
    ],
  },
};
