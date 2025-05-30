import type { Meta, StoryObj } from '@storybook/react';
import { EventReplay } from './EventReplay';

const meta: Meta<typeof EventReplay> = {
  component: EventReplay,
  title: 'core/EventReplay',
};

export default meta;
type Story = StoryObj<typeof EventReplay>;

export const Primary: Story = {
  args: {
    items: [
      {
        event: 'Started agent inference',
        icon: <span>🔍</span>,
        timestamp: '2023-10-01T12:00:00Z',
        details: <div>Details for Event 1</div>,
      },
      {
        event: 'Send LLM request to model',
        icon: <span>⚙️</span>,
        timestamp: '2023-10-01T12:05:00Z',
        duration: 3000000, // 3 seconds in nanoseconds
        details: <div>Details for Event 2</div>,
      },
      {
        event: 'Send LLM request to model',
        icon: <span>⚙️</span>,
        timestamp: '2023-10-01T12:05:00Z',
        duration: 3000000, // 3 seconds in nanoseconds
        details: <div>Details for Event 2</div>,
      },
      {
        event: 'Execute tool',
        icon: <span>⚙️</span>,
        timestamp: '2023-10-01T12:05:00Z',
        duration: 3000000, // 3 seconds in nanoseconds
        details: <div>Details for Event 2</div>,
      },
      {
        event: 'Completed agent inference',
        icon: <span>🔍</span>,
        timestamp: '2023-10-01T12:00:00Z',
        details: <div>Details for Event 1</div>,
      },
    ],
  },
};
