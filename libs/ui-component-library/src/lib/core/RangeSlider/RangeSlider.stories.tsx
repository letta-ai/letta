import type { Meta, StoryObj } from '@storybook/react';
import { RangeSlider } from './RangeSlider';

const meta: Meta<typeof RangeSlider> = {
  component: RangeSlider,
  title: 'core/RangeSlider',
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    min: { control: 'number', defaultValue: 0 },
    max: { control: 'number', defaultValue: 100 },
    step: { control: 'number', defaultValue: 1 },
    disabled: { control: 'boolean', defaultValue: false },
    labelPosition: {
      control: 'select',
      options: ['top', 'bottom'],
      defaultValue: 'top',
    },
    fullWidth: { control: 'boolean', defaultValue: true },
    label: { control: 'text' },
    errorMessage: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof RangeSlider>;

export const Default: Story = {
  args: {
    values: [25, 75],
    min: 0,
    max: 100,
    step: 1,
  },
};

export const WithCustomLabels: Story = {
  args: {
    values: [15, 30],
    min: 0,
    max: 100,
    formatLabel: (value) => `${value} msgs`,
  },
};

export const LabelsOnBottom: Story = {
  args: {
    values: [20, 60],
    min: 0,
    max: 100,
    labelPosition: 'bottom',
  },
};

export const Disabled: Story = {
  args: {
    values: [10, 90],
    min: 0,
    max: 100,
    disabled: true,
  },
};

export const CustomRange: Story = {
  args: {
    values: [400, 1600],
    min: 0,
    max: 2000,
    step: 100,
    formatLabel: (value) => `${value}ms`,
  },
};

export const WithLabelAndError: Story = {
  args: {
    values: [30, 70],
    min: 0,
    max: 100,
    label: 'Message Buffer Length',
    errorMessage: 'Min value must be less than max value',
  },
};
