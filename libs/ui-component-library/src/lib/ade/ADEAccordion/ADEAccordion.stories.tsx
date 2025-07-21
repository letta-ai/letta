import type { Meta, StoryObj } from '@storybook/react';
import { ADEAccordion } from './ADEAccordion';

const meta: Meta<typeof ADEAccordion> = {
  component: ADEAccordion,
  title: 'ade/ADEAccordion',
};

export default meta;
type Story = StoryObj<typeof ADEAccordion>;

export const Default: Story = {
  args: {
    id: 'accordion-1',
    label: 'Click to expand',
    children: 'This is the accordion content that appears when expanded.',
  },
};

export const DefaultOpen: Story = {
  args: {
    id: 'accordion-2',
    label: 'This accordion starts open',
    children: 'You can see this content immediately when the component loads.',
    defaultOpen: true,
  },
};
