import type { Meta, StoryObj } from '@storybook/react';
import { FadeInImage } from './FadeInImage';

const meta: Meta<typeof FadeInImage> = {
  component: FadeInImage,
  title: 'reusable/FadeInImage',
};

export default meta;
type Story = StoryObj<typeof FadeInImage>;

export const Primary: Story = {};
