import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import {
  DatePicker,
  DateTimePicker,
  DateTimePicker24h,
  DateRangePicker,
  DateTimeRangePicker,
} from './DateTimePicker';
import { generateWrapWithFormContext } from '../../../helpers';

const formContextDecorator = generateWrapWithFormContext({
  alternativeText: 'Use <RawDatePicker /> instead if you dont need the Form',
});

// Wrapper components with state management
function DatePickerWrapper(props: {
  label?: string;
  value?: Date;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [date, setDate] = useState<Date | undefined>(props.value);
  return (
    <div className="w-80">
      <DatePicker {...props} value={date} onValueChange={setDate} />
      <p className="mt-2 text-sm text-text-lighter">
        Selected: {date ? date.toLocaleDateString() : 'None'}
      </p>
    </div>
  );
}

function DateTimePickerWrapper(props: {
  label?: string;
  value?: Date;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [datetime, setDatetime] = useState<Date | undefined>(props.value);
  return (
    <div className="w-80">
      <DateTimePicker {...props} value={datetime} onValueChange={setDatetime} />
      <p className="mt-2 text-sm text-text-lighter">
        Selected: {datetime ? datetime.toLocaleString() : 'None'}
      </p>
    </div>
  );
}

function DateTimePicker24hWrapper(props: {
  label?: string;
  value?: Date;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [datetime, setDatetime] = useState<Date | undefined>(props.value);
  return (
    <div className="w-80">
      <DateTimePicker24h
        {...props}
        value={datetime}
        onValueChange={setDatetime}
      />
      <p className="mt-2 text-sm text-text-lighter">
        Selected:{' '}
        {datetime
          ? datetime.toLocaleString('en-US', { hour12: false })
          : 'None'}
      </p>
    </div>
  );
}

function DateRangePickerWrapper(props: {
  label?: string;
  value?: { from: Date; to?: Date };
  placeholder?: string;
  disabled?: boolean;
}) {
  const [dateRange, setDateRange] = useState<
    { from: Date; to?: Date } | undefined
  >(props.value);
  return (
    <div className="w-80">
      <DateRangePicker
        {...props}
        value={dateRange}
        onValueChange={setDateRange}
      />
      <p className="mt-2 text-sm text-text-lighter">
        From: {dateRange?.from ? dateRange.from.toLocaleDateString() : 'None'}
      </p>
      <p className="text-sm text-text-lighter">
        To: {dateRange?.to ? dateRange.to.toLocaleDateString() : 'None'}
      </p>
    </div>
  );
}

function DateTimeRangePickerWrapper(props: {
  label?: string;
  value?: { from: Date; to?: Date };
  placeholder?: string;
  disabled?: boolean;
  format24h?: boolean;
}) {
  const [dateTimeRange, setDateTimeRange] = useState<
    { from: Date; to?: Date } | undefined
  >(props.value);
  return (
    <div className="w-80">
      <DateTimeRangePicker
        {...props}
        value={dateTimeRange}
        onValueChange={setDateTimeRange}
      />
      <p className="mt-2 text-sm text-text-lighter">
        From:{' '}
        {dateTimeRange?.from ? dateTimeRange.from.toLocaleString() : 'None'}
      </p>
      <p className="text-sm text-text-lighter">
        To: {dateTimeRange?.to ? dateTimeRange.to.toLocaleString() : 'None'}
      </p>
    </div>
  );
}

const meta: Meta<typeof DateTimePicker> = {
  title: 'Core/DateTimePicker',
  component: DateTimePicker,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    disabled: {
      control: { type: 'boolean' },
    },
    hideLabel: {
      control: { type: 'boolean' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof DateTimePicker>;

export const DatePickerStory: Story = {
  name: 'Date Picker',
  render: (args) => <DatePickerWrapper {...args} />,
  args: {
    label: 'Date',
    placeholder: 'Select a date',
  },
  decorators: [formContextDecorator],
};

export const DateTimePickerStory: Story = {
  name: 'DateTime Picker (12-hour)',
  render: (args) => <DateTimePickerWrapper {...args} />,
  args: {
    label: 'Date & Time',
    placeholder: 'Select date and time',
  },
  decorators: [formContextDecorator],
};

export const DateTimePicker24hStory: Story = {
  name: 'DateTime Picker (24-hour)',
  render: (args) => <DateTimePicker24hWrapper {...args} />,
  args: {
    label: 'Date & Time (24h)',
    placeholder: 'Select date and time (24h)',
  },
  decorators: [formContextDecorator],
};

export const DateRangePickerStory: Story = {
  name: 'Date Range Picker',
  render: (args) => <DateRangePickerWrapper {...args} />,
  args: {
    label: 'Date Range',
    placeholder: 'Select date range',
  },
  decorators: [formContextDecorator],
};

export const WithPresetDate: Story = {
  name: 'Date Picker with Preset',
  render: (args) => <DatePickerWrapper {...args} />,
  args: {
    label: 'Preset Date',
    value: new Date(),
    placeholder: 'Date with preset value',
  },
  decorators: [formContextDecorator],
};

export const WithPresetDateTime: Story = {
  name: 'DateTime Picker with Preset',
  render: (args) => <DateTimePickerWrapper {...args} />,
  args: {
    label: 'Preset DateTime',
    value: new Date(),
    placeholder: 'DateTime with preset value',
  },
  decorators: [formContextDecorator],
};

export const WithPresetDateRange: Story = {
  name: 'Date Range with Preset',
  render: (args) => <DateRangePickerWrapper {...args} />,
  args: {
    label: 'Preset Date Range',
    value: {
      from: new Date(),
      to: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    },
    placeholder: 'Date range with preset values',
  },
  decorators: [formContextDecorator],
};

export const DisabledWithValue: Story = {
  name: 'Disabled with Value',
  render: (args) => (
    <div className="w-80">
      <DateTimePicker {...args} />
    </div>
  ),
  args: {
    label: 'Disabled DateTime',
    value: new Date(),
    disabled: true,
  },
  decorators: [formContextDecorator],
};

export const DisabledEmpty: Story = {
  name: 'Disabled Empty',
  render: (args) => (
    <div className="w-80">
      <DateTimePicker {...args} />
    </div>
  ),
  args: {
    label: 'Disabled Empty',
    value: undefined,
    disabled: true,
    placeholder: 'This is disabled',
  },
  decorators: [formContextDecorator],
};

export const DateTimeRangePickerStory: Story = {
  name: 'DateTime Range Picker (12-hour)',
  render: (args) => <DateTimeRangePickerWrapper {...args} />,
  args: {
    label: 'DateTime Range',
    placeholder: 'Select date and time range',
  },
  decorators: [formContextDecorator],
};

export const DateTimeRangePickerWith24h: Story = {
  name: 'DateTime Range Picker (24-hour)',
  render: (args) => <DateTimeRangePickerWrapper {...args} />,
  args: {
    label: 'DateTime Range (24h)',
    placeholder: 'Select date and time range (24h)',
    format24h: true,
  },
  decorators: [formContextDecorator],
};

export const DateTimeRangeWithPreset: Story = {
  name: 'DateTime Range with Preset',
  render: (args) => <DateTimeRangePickerWrapper {...args} />,
  args: {
    label: 'Preset DateTime Range',
    value: {
      from: new Date(),
      to: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
    },
    placeholder: 'DateTime range with preset values',
  },
  decorators: [formContextDecorator],
};

export const HiddenLabel: Story = {
  name: 'Hidden Label',
  render: (args) => <DatePickerWrapper {...args} />,
  args: {
    label: 'Hidden Label Date',
    hideLabel: true,
    placeholder: 'Label is hidden but accessible',
  },
  decorators: [formContextDecorator],
};

export const Playground: Story = {
  name: 'Playground',
  render: (args) => <DateTimePickerWrapper {...args} />,
  args: {
    label: 'Playground DateTime',
    placeholder: 'Try different props...',
    disabled: false,
    hideLabel: false,
  },
  decorators: [formContextDecorator],
};
