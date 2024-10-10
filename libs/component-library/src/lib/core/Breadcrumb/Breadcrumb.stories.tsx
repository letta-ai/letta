import type { Meta, StoryObj } from '@storybook/react';
import { Breadcrumb } from './Breadcrumb';

const meta: Meta<typeof Breadcrumb> = {
  component: Breadcrumb,
  title: 'core/Breadcrumb',
};

export default meta;
type Story = StoryObj<typeof Breadcrumb>;

export const Primary: Story = {
  args: {
    items: [
      { label: 'Home', href: '/' },
      { label: 'Products', href: '/products' },
      { label: 'Product 1', href: '/products/1' },
    ],
    variant: 'heading1',
  },
  argTypes: {
    variant: {
      description: 'The typography variant for the breadcrumb items',
      options: [
        'heading1',
        'heading2',
        'heading3',
        'heading4',
        'heading5',
        'body',
        'body2',
      ],
      control: { type: 'radio' },
    },
  },
};
