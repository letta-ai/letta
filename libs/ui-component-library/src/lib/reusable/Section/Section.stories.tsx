import type { Meta, StoryObj } from '@storybook/react';
import { Section } from './Section';

const meta: Meta<typeof Section> = {
  component: Section,
  title: 'reusable/Section',
};

export default meta;
type Story = StoryObj<typeof Section>;

export const Primary: Story = {};
