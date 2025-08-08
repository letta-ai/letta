import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { QueryBuilder, type QueryBuilderQuery, type FieldDefinitions } from './QueryBuilder';

// Wrapper component to handle state
function StatefulQueryBuilder(props: {
  definition: FieldDefinitions;
  initialQuery?: QueryBuilderQuery;
}) {
  const [query, setQuery] = useState<QueryBuilderQuery>(
    props.initialQuery || {
      root: {
        combinator: 'AND',
        items: [],
      },
    }
  );

  return (
    <div>
      <QueryBuilder
        query={query}
        onSetQuery={setQuery}
        definition={props.definition}
      />
      <div className="mt-6 p-4 bg-gray-100 rounded">
        <h3 className="text-sm font-medium mb-2">Current Query State:</h3>
        <pre className="text-xs overflow-auto max-h-96">
          {JSON.stringify(query, null, 2)}
        </pre>
      </div>
    </div>
  );
}

const meta: Meta<typeof QueryBuilder> = {
  component: QueryBuilder,
  title: 'core/QueryBuilder',
};

export default meta;
type Story = StoryObj<typeof QueryBuilder>;

export const Primary: Story = {
  render: () => (
    <StatefulQueryBuilder
      definition={{
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
      }}
    />
  ),
};

export const AllFieldTypes: Story = {
  render: () => (
    <StatefulQueryBuilder
      definition={{
        // Text input field
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
                  { label: 'Equals', value: 'eq' },
                  { label: 'Not Equals', value: 'neq' },
                  { label: 'Contains', value: 'contains' },
                  { label: 'Starts With', value: 'startsWith' },
                  { label: 'Ends With', value: 'endsWith' },
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
        // Select field
        status: {
          id: 'status',
          name: 'Status',
          queries: [
            {
              key: 'operator',
              label: 'Operator',
              display: 'select',
              options: {
                options: [
                  { label: 'Is', value: 'eq' },
                  { label: 'Is Not', value: 'neq' },
                  { label: 'Is One Of', value: 'in' },
                ],
              },
            },
            {
              key: 'value',
              label: 'Status',
              display: 'select',
              options: {
                options: [
                  { label: 'Active', value: 'active' },
                  { label: 'Inactive', value: 'inactive' },
                  { label: 'Pending', value: 'pending' },
                  { label: 'Archived', value: 'archived' },
                ],
              },
            },
          ],
        },
        // Async select field
        assignee: {
          id: 'assignee',
          name: 'Assignee',
          queries: [
            {
              key: 'operator',
              label: 'Operator',
              display: 'select',
              options: {
                options: [
                  { label: 'Is', value: 'eq' },
                  { label: 'Is Not', value: 'neq' },
                ],
              },
            },
            {
              key: 'user',
              label: 'User',
              display: 'async-select',
              options: {
                loadOptions: async (inputValue: string) => {
                  // Simulate async loading
                  await new Promise(resolve => setTimeout(resolve, 300));
                  const users = [
                    { label: 'John Doe', value: 'john' },
                    { label: 'Jane Smith', value: 'jane' },
                    { label: 'Bob Johnson', value: 'bob' },
                    { label: 'Alice Brown', value: 'alice' },
                  ];
                  return users.filter(user => 
                    user.label.toLowerCase().includes(inputValue.toLowerCase())
                  );
                },
                placeholder: 'Search users...',
              },
            },
          ],
        },
        // Date picker field
        createdDate: {
          id: 'createdDate',
          name: 'Created Date',
          queries: [
            {
              key: 'operator',
              label: 'Operator',
              display: 'select',
              options: {
                options: [
                  { label: 'On', value: 'eq' },
                  { label: 'After', value: 'gt' },
                  { label: 'Before', value: 'lt' },
                  { label: 'On or After', value: 'gte' },
                  { label: 'On or Before', value: 'lte' },
                ],
              },
            },
            {
              key: 'date',
              label: 'Date',
              display: 'date-picker',
              options: {
                placeholder: 'Select date',
              },
            },
          ],
        },
        // DateTime picker (12-hour format)
        lastModified: {
          id: 'lastModified',
          name: 'Last Modified',
          queries: [
            {
              key: 'operator',
              label: 'Operator',
              display: 'select',
              options: {
                options: [
                  { label: 'On', value: 'eq' },
                  { label: 'After', value: 'gt' },
                  { label: 'Before', value: 'lt' },
                ],
              },
            },
            {
              key: 'datetime',
              label: 'Date & Time (12h)',
              display: 'datetime-picker',
              options: {
                placeholder: 'Select date and time',
                format24h: false,
              },
            },
          ],
        },
        // DateTime picker (24-hour format)
        scheduledTime: {
          id: 'scheduledTime',
          name: 'Scheduled Time',
          queries: [
            {
              key: 'operator',
              label: 'Operator',
              display: 'select',
              options: {
                options: [
                  { label: 'At', value: 'eq' },
                  { label: 'After', value: 'gt' },
                  { label: 'Before', value: 'lt' },
                ],
              },
            },
            {
              key: 'datetime24',
              label: 'Date & Time (24h)',
              display: 'datetime-picker',
              options: {
                placeholder: 'Select date and time',
                format24h: true,
              },
            },
          ],
        },
        // Date range picker
        eventPeriod: {
          id: 'eventPeriod',
          name: 'Event Period',
          queries: [
            {
              key: 'dateRange',
              label: 'Date Range',
              display: 'date-range-picker',
              options: {
                placeholder: 'Select date range',
              },
            },
          ],
        },
        // DateTime range picker (12-hour format)
        sessionWindow: {
          id: 'sessionWindow',
          name: 'Session Window',
          queries: [
            {
              key: 'datetimeRange12',
              label: 'DateTime Range (12h)',
              display: 'datetime-range-picker',
              options: {
                placeholder: 'Select datetime range',
                format24h: false,
              },
            },
          ],
        },
        // DateTime range picker (24-hour format)
        operatingHours: {
          id: 'operatingHours',
          name: 'Operating Hours',
          queries: [
            {
              key: 'datetimeRange24',
              label: 'DateTime Range (24h)',
              display: 'datetime-range-picker',
              options: {
                placeholder: 'Select datetime range',
                format24h: true,
              },
            },
          ],
        },
      }}
    />
  ),
};
