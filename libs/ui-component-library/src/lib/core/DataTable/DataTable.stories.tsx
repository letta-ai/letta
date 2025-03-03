import type { Meta, StoryObj } from '@storybook/react';
import { DataTable } from './DataTable';

const meta: Meta<typeof DataTable> = {
  component: DataTable,
  title: 'core/DataTable',
};

export default meta;
type Story = StoryObj<
  typeof DataTable<
    {
      name: string;
      age: number;
      role: string;
    },
    {
      name: string;
      age: number;
      role: string;
    }
  >
>;

export const Primary: Story = {
  argTypes: {
    columns: {
      control: {
        type: 'object',
      },
    },
    data: {
      control: {
        type: 'object',
      },
    },
  },
  args: {
    columns: [
      {
        header: 'Name',
        accessorKey: 'name',
      },
      {
        header: 'Age',
        accessorKey: 'age',
      },
      {
        header: 'Role',
        accessorKey: 'role',
      },
    ],
    data: [
      {
        name: 'John Doe',
        age: 30,
        role: 'Software Engineer',
      },
      {
        name: 'Jane Doe',
        age: 28,
        role: 'Product Manager',
      },
    ],
  },
};
