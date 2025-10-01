import type { Meta, StoryObj } from '@storybook/react';
import { useState, useEffect } from 'react';
import { CoreMemoryCard, type CoreMemoryCardInterface } from './CoreMemoryCard';

const meta: Meta<typeof CoreMemoryCard> = {
  component: CoreMemoryCard,
  title: 'reusable/CoreMemoryCard',
};

export default meta;
type Story = StoryObj<typeof CoreMemoryCard>;

const ChangeStateWrapper = (args: CoreMemoryCardInterface) => {
  const [lastUpdatedAt, setLastUpdatedAt] = useState(
    '2024-01-15T10:30:00.000Z',
  );

  const [value, setValue] = useState(args.value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLastUpdatedAt(new Date().toISOString());
      setValue('new update here');
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  return (
    <CoreMemoryCard {...args} lastUpdatedAt={lastUpdatedAt} value={value} />
  );
};

export const Primary: Story = {
  render: (args) => <ChangeStateWrapper {...args} />,
  args: {
    label: 'core memory label',
    value:
      'update this memory over time as I interact with the human and learn more about them. hey youupdate this memory over time as I interact with the human and learn more about them. hey youupdate this memory over time as I interact with the human and learn more about them. hey youupdate this memory over time as I interact with the human and learn more about them. hey youupdate this memory over time as I interact with the human and learn more about them. hey you',
    infoToolTipContent: 'info tooltip stuff here',
    sharedAgents: [
      {
        id: '1',
        name: 'Agent 1',
        agentType: 'memgpt_agent',
        onClick: () => console.log('Clicked Agent 1'),
      },
      {
        id: '2',
        name: 'Agent 2',
        agentType: 'memgpt_agent',
        onClick: () => console.log('Clicked Agent 2'),
      },
    ],
    readOnly: false,
    preserveOnMigration: true,
  },
};

export const OldState: Story = {
  args: {
    label: 'core memory label',
    value:
      'update this memory over time as I interact with the human and learn more about them. hey youupdate this memory over time as I interact with the human and learn more about them. hey youupdate this memory over time as I interact with the human and learn more about them. hey youupdate this memory over time as I interact with the human and learn more about them. hey youupdate this memory over time as I interact with the human and learn more about them. hey you',
    infoToolTipContent: 'info tooltip stuff here',
    lastUpdatedAt: '2024-01-15T10:30:00.000Z',
    sharedAgents: [
      {
        id: '1',
        name: 'Agent 1',
        agentType: 'memgpt_agent',
        onClick: () => console.log('Clicked Agent 1'),
      },
      {
        id: '2',
        name: 'Agent 2',
        agentType: 'memgpt_agent',
        onClick: () => console.log('Clicked Agent 2'),
      },
    ],
    readOnly: true,
  },
};

export const EmptyState: Story = {
  args: {
    label: 'core memory label',
    value: undefined,
    infoToolTipContent: 'info tooltip stuff here',
    lastUpdatedAt: '2024-01-15T10:30:00.000Z',
    sharedAgents: [
      {
        id: '1',
        name: 'Agent 1',
        agentType: 'memgpt_agent',
        onClick: () => console.log('Clicked Agent 1'),
      },
      {
        id: '2',
        name: 'Agent 2',
        agentType: 'memgpt_agent',
        onClick: () => console.log('Clicked Agent 2'),
      },
    ],
    readOnly: false,
    preserveOnMigration: true,
  },
};

export const EmptyStateNoAgents: Story = {
  args: {
    label: 'core memory label',
    value: undefined,
  },
};

export const EmptyToNewValues: Story = {
  render: (args) => <ChangeStateWrapper {...args} />,
  args: {
    label: 'core memory label',
  },
};

const ValuesToEmptyWrapper = (args: CoreMemoryCardInterface) => {
  const [lastUpdatedAt, setLastUpdatedAt] = useState(
    '2024-01-15T10:30:00.000Z',
  );

  const [value, setValue] = useState(args.value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLastUpdatedAt(new Date().toISOString());
      setValue('');
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  return (
    <CoreMemoryCard {...args} lastUpdatedAt={lastUpdatedAt} value={value} />
  );
};

export const ValuesToEmpty: Story = {
  render: (args) => <ValuesToEmptyWrapper {...args} />,
  args: {
    label: 'core memory label',
    value:
      'I have values here update this memory over time as I interact with the human and learn more about them',
    infoToolTipContent: 'info tooltip stuff here',
    lastUpdatedAt: '2024-01-15T10:30:00.000Z',
    sharedAgents: [
      {
        id: '1',
        name: 'Agent 1',
        agentType: 'memgpt_agent',
        onClick: () => console.log('Clicked Agent 1'),
      },
      {
        id: '2',
        name: 'Agent 2',
        agentType: 'memgpt_agent',
        onClick: () => console.log('Clicked Agent 2'),
      },
    ],
  },
};
