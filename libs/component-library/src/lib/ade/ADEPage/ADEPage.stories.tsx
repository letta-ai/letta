import type { Meta, StoryObj } from '@storybook/react';
import { ADEPage } from './ADEPage';

const meta: Meta<typeof ADEPage> = {
  component: ADEPage,
  title: 'ade/ADEPage',
};

export default meta;
type Story = StoryObj<typeof ADEPage>;

export const Primary: Story = {};
