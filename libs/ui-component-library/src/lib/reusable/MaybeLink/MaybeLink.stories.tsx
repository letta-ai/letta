import type { Meta, StoryObj } from '@storybook/react';
import { MaybeLink } from './MaybeLink';

const meta: Meta<typeof MaybeLink> = {
  component: MaybeLink,
  title: 'reusable/MaybeLink',
};

export default meta;
type Story = StoryObj<typeof MaybeLink>;

export const Primary: Story = {};
