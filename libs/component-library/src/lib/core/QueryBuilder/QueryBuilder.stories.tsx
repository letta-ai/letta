import type { Meta, StoryObj } from '@storybook/react';
import { QueryBuilder } from './QueryBuilder';

const meta: Meta<typeof QueryBuilder> = {
  component: QueryBuilder,
  title: 'core/QueryBuilder',
};

export default meta;
type Story = StoryObj<typeof QueryBuilder>;

export const Primary: Story = {
  args: {
    onSetQuery: undefined,
    definition: {
      templateName: {
        id: 'templateName',
        name: 'Template Name',
        queries: [
          {
            key: 'operator',
            label: 'Operator',
            display: 'select',
            options: {
              options: [
                {
                  label: 'Equals',
                  value: 'eq',
                },
                {
                  label: 'Not Equals',
                  value: 'neq',
                },
                {
                  label: 'Contains',
                  value: 'contains',
                },
              ],
            },
          },
          {
            key: 'value',
            label: 'Value',
            display: 'input',
          },
        ],
      },
    },
    query: {
      root: {
        combinator: 'AND',
        items: [],
      },
    },
  },
};
