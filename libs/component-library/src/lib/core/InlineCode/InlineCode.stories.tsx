import type { Meta, StoryObj } from '@storybook/react';
import { InlineCode } from './InlineCode';

const meta: Meta<typeof InlineCode> = {
  component: InlineCode,
  title: 'core/InlineCode',
};

export default meta;
type Story = StoryObj<typeof InlineCode>;

export const Primary: Story = {};
