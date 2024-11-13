import type { Meta, StoryObj } from '@storybook/react';
import { Dialog, DialogContentWithCategories } from './Dialog';
import { Button } from '../Button/Button';
import { PlusIcon } from '../../icons';

const meta: Meta<typeof Dialog> = {
  component: Dialog,
  title: 'core/Dialog',
};

export default meta;
type Story = StoryObj<typeof Dialog>;

export const Primary: Story = {
  argTypes: {
    isOpen: {
      control: {
        type: 'boolean',
      },
    },
    onOpenChange: {},
    trigger: {},
    title: {
      control: {
        type: 'text',
      },
    },
    children: {
      control: {
        type: 'text',
      },
    },
  },
  args: {
    title: 'Dialog Title',
    children: 'Dialog Content',
    trigger: <Button label="Open Dialog"></Button>,
  },
};

export const WithCategories: Story = {
  argTypes: {
    isOpen: {
      control: {
        type: 'boolean',
      },
    },
    onOpenChange: {},
    trigger: {},
    title: {
      control: {
        type: 'text',
      },
    },
    children: {
      control: {
        type: 'text',
      },
    },
  },
  args: {
    size: 'full',
    title: 'Dialog Title',
    children: (
      <DialogContentWithCategories
        categories={[
          {
            id: 'category',
            icon: <PlusIcon />,
            title: 'Category 1',
            subtitle: 'Test',
            children: 'Category 1 Content',
          },
          {
            id: 'category2',
            title: 'Category 2',
            subtitle: 'test',
            children: 'Category 2 Content',
          },
          {
            id: 'category3',
            title: 'Category 3',
            children: 'Category 3 Content',
          }
        ]}
      />
    ),
    trigger: <Button label="Open Dialog"></Button>,
  },
};
