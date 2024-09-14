import type { Meta, StoryObj } from '@storybook/react';
import { SingleFileUpload } from './SingleFileUpload';

const meta: Meta<typeof SingleFileUpload> = {
  component: SingleFileUpload,
  title: 'core/FileUpload',
};

export default meta;
type Story = StoryObj<typeof SingleFileUpload>;

export const Primary: Story = {};
