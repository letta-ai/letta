import type { Meta, StoryObj } from '@storybook/react';
import { CardButton } from './CardButton';
import { LettaInvaderOutlineIcon } from '@letta-cloud/ui-component-library';

const meta: Meta<typeof CardButton> = {
  component: CardButton,
  title: 'reusable/CardButton',
};

export default meta;
type Story = StoryObj<typeof CardButton>;

export const Primary: Story = {
  args: {
    id: 'primary-1',
    label: 'card-button-primary',
    url: '/projects',
  },
};

export const Loading: Story = {
  args: {
    id: 'loading-1',
  },
};

export const WithIcon: Story = {
  args: {
    id: 'with-icon-1',
    preIcon: <LettaInvaderOutlineIcon />,
    label: 'card-button-with-icon-and-internal-url',
    url: '/projects',
  },
};

export const WithOpenNewTab: Story = {
  args: {
    id: 'with-icon-1',
    preIcon: <LettaInvaderOutlineIcon />,
    label: 'card-button-with-external-url',
    url: 'https://letta.com',
  },
};
