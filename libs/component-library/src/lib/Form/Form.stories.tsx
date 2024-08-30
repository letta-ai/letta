import type { Meta, StoryObj } from '@storybook/react';
import { Form } from './Form';

const meta: Meta<typeof Form> = {
  component: Form,
  title: 'Components/Form',
};

export default meta;
type Story = StoryObj<typeof Form>;

export const Primary: Story = {};
