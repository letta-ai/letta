import type { Meta, StoryObj } from '@storybook/react';
import { ExternalLink } from './ExternalLink';

const meta: Meta<typeof ExternalLink> = {
  component: ExternalLink,
  title: 'reusable/ExternalLink',
};

export default meta;
type Story = StoryObj<typeof ExternalLink>;

export const Primary: Story = {};
