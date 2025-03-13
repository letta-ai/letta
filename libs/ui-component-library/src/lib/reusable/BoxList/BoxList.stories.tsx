import type { Meta, StoryObj } from '@storybook/react';
import { BoxList } from './BoxList';
import { PlusIcon, TemplateIcon } from '../../icons';
import { Button } from '../../core/Button/Button';

const meta: Meta<typeof BoxList> = {
  component: BoxList,
  title: 'reusable/BoxList',
};

export default meta;
type Story = StoryObj<typeof BoxList>;

export const Primary: Story = {
  args: {
    title: 'BoxList',
    items: [],
    loadingConfig: {
      isLoading: false,
      rowsToDisplay: 2,
    },
    emptyConfig: {
      icon: <TemplateIcon />,
      title: 'New Agent Template',
      description: 'Start from scratch or use and modify an existing template',
      action: <Button label="Create template" size="large" />,
    },
    topRightAction: (
      <Button label="" size="small" hideLabel preIcon={<PlusIcon />} />
    ),
    bottomAction: 'Bottom Action',
  },
};

export const withItems: Story = {
  args: {
    title: 'BoxList',
    items: [
      {
        title: 'Title',
        description: 'Description',
        action: <Button label="Action" size="small" />,
      },
      {
        title: 'Title',
        description: 'Description',
        action: <Button label="Action" size="small" />,
      },
    ],
    loadingConfig: {
      isLoading: false,
      rowsToDisplay: 2,
    },
    emptyConfig: {
      icon: <TemplateIcon />,
      title: 'New Agent Template',
      description: 'Description',
      action: <Button label="Create template" size="large" />,
    },
    topRightAction: (
      <Button label="" hideLabel size="small" preIcon={<PlusIcon />} />
    ),
    bottomAction: (
      <Button label="Bottom Action" size="small" color="tertiary" />
    ),
  },
};

export const isLoading: Story = {
  args: {
    title: 'BoxList',
    items: [],
    loadingConfig: {
      isLoading: true,
      rowsToDisplay: 2,
    },
    emptyConfig: {
      icon: <TemplateIcon />,
      title: 'New Agent Template',
      description: 'Description',
      action: <Button label="Create template" size="large" />,
    },
    topRightAction: (
      <Button label="" size="small" hideLabel preIcon={<PlusIcon />} />
    ),
    bottomAction: 'Bottom Action',
  },
};
