import type { Meta, StoryObj } from '@storybook/react';
import { DownloadButton } from './DownloadButton';

const meta: Meta<typeof DownloadButton> = {
  component: DownloadButton,
  title: 'reusable/DownloadButton',
};

export default meta;
type Story = StoryObj<typeof DownloadButton>;

export const Primary: Story = {};
