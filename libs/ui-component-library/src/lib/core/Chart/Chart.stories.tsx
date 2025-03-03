import type { Meta, StoryObj } from '@storybook/react';
import { Chart } from './Chart';

const meta: Meta<typeof Chart> = {
  component: Chart,
  title: 'core/Chart',
};

export default meta;
type Story = StoryObj<typeof Chart>;

export const Primary: Story = {
  args: {
    options: {
      xAxis: {
        type: 'category',
        data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      },
      yAxis: {
        type: 'value',
      },
      series: [
        {
          data: [150, 230, 224, 218, 135, 147, 260],
          type: 'line',
        },
      ],
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[800px] h-[300px]">
        <Story />
      </div>
    ),
  ],
};
