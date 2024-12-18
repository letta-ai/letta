import type { Meta, StoryObj } from '@storybook/react';
import { AdBanner } from './AdBanner';

const meta: Meta<typeof AdBanner> = {
  component: AdBanner,
  title: 'core/AdBanner',
};

export default meta;
type Story = StoryObj<typeof AdBanner>;

export const Primary: Story = {};
