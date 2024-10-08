import type { Meta, StoryObj } from '@storybook/react';
import { NiceGridDisplay } from './NiceGridDisplay';

const meta: Meta<typeof NiceGridDisplay> = {
  component: NiceGridDisplay,
  title: 'reusable/NiceGridDisplay',
};

export default meta;
type Story = StoryObj<typeof NiceGridDisplay>;

export const Primary: Story = {};
