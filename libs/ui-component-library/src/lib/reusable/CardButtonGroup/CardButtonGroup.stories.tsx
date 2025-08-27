import type { Meta, StoryObj } from '@storybook/react';
import { CardButtonGroup } from './CardButtonGroup';
import { InvaderSharedAgentIcon } from '@letta-cloud/ui-component-library';

const meta: Meta<typeof CardButtonGroup> = {
  component: CardButtonGroup,
  title: 'reusable/CardButtonGroup',
};

export default meta;
type Story = StoryObj<typeof CardButtonGroup>;

export const Primary: Story = {
  args: {
    items: [
      {
        id: 'primary-1',
        label: 'card-button-primary',
        url: '/projects',
      },
      {
        id: 'primary-2',
        label: 'card-button-primary-internal-url',
        url: '/projects',
      },
      {
        id: 'url-1',
        label: 'card-button-external-url',
        url: 'https://letta.com',
      },
      {
        id: 'url-2',
        label: 'card-button-with-icon',
        url: 'https://letta.com',
        preIcon: <InvaderSharedAgentIcon />,
      },
    ],
    isLoading: false,
    minRows: 3,
  },
};

export const Loading: Story = {
  args: {
    items: [
      {
        id: 'primary-1',
        label: 'card-button-primary',
        url: '/projects',
      },
      {
        id: 'primary-2',
        label: 'card-button-primary-internal-url',
        url: '/projects',
      },
      {
        id: 'url-1',
        label: 'card-button-external-url',
        url: 'https://letta.com',
      },
      {
        id: 'url-2',
        label: 'card-button-with-icon',
        url: 'https://letta.com',
        preIcon: <InvaderSharedAgentIcon />,
      },
    ],
    isLoading: true,
    minRows: 3,
  },
};

export const EmptyState: Story = {
  args: {
    items: [],
    minRows: 3,
    emptyConfig: {
      className: 'h-[90px]',
    },
  },
};

export const EmptyStateCustomLabel: Story = {
  args: {
    items: [],
    minRows: 3,
    emptyConfig: {
      label: 'Custom label here',
      className: 'h-[90px]',
    },
  },
};
