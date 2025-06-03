import type { Meta, StoryObj } from '@storybook/react';
import { Accordion } from './Accordion';

const meta: Meta<typeof Accordion> = {
  component: Accordion,
  title: 'core/Accordion',
  tags: ['autodocs'],
  argTypes: {
    trigger: {
      control: 'text',
      description: 'The content to display in the accordion trigger',
    },
    children: {
      control: 'text',
      description: 'The content to display when the accordion is expanded',
    },
    defaultOpen: {
      control: 'boolean',
      description: 'Whether the accordion should be open by default',
    },
    id: {
      control: 'text',
      description: 'Unique identifier for the accordion item',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Accordion>;

export const Default: Story = {
  args: {
    id: 'accordion-1',
    trigger: 'Click to expand',
    children: 'This is the accordion content that appears when expanded.',
  },
};

export const DefaultOpen: Story = {
  args: {
    id: 'accordion-2',
    trigger: 'This accordion starts open',
    children: 'You can see this content immediately when the component loads.',
    defaultOpen: true,
  },
};

export const WithLongContent: Story = {
  args: {
    id: 'accordion-3',
    trigger: 'Accordion with longer content',
    children: (
      <div className="space-y-4">
        <p>This accordion contains multiple paragraphs of content.</p>
        <p>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
          eiusmod tempor incididunt ut labore et dolore magna aliqua.
        </p>
        <p>
          Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris
          nisi ut aliquip ex ea commodo consequat.
        </p>
      </div>
    ),
  },
};

export const WithCustomContent: Story = {
  args: {
    id: 'accordion-4',
    trigger: (
      <div className="flex items-center gap-2">
        <span className="font-semibold">Settings</span>
        <span className="text-sm text-muted">(3 items)</span>
      </div>
    ),
    children: (
      <div className="space-y-2">
        <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
          <span>Notifications</span>
          <span className="text-sm text-muted">Enabled</span>
        </div>
        <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
          <span>Dark Mode</span>
          <span className="text-sm text-muted">Disabled</span>
        </div>
        <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
          <span>Language</span>
          <span className="text-sm text-muted">English</span>
        </div>
      </div>
    ),
  },
};

export const MultipleAccordions: Story = {
  render: () => (
    <div className="space-y-2">
      <Accordion id="multi-1" trigger="First Section" defaultOpen={true}>
        <p>Content for the first section.</p>
      </Accordion>
      <Accordion id="multi-2" trigger="Second Section">
        <p>Content for the second section.</p>
      </Accordion>
      <Accordion id="multi-3" trigger="Third Section">
        <p>Content for the third section.</p>
      </Accordion>
    </div>
  ),
};

export const NestedAccordions: Story = {
  render: () => (
    <Accordion id="parent" trigger="Parent Accordion" defaultOpen={true}>
      <div className="space-y-4">
        <p>This parent accordion contains nested accordions:</p>
        <div className="ml-4 space-y-2">
          <Accordion id="child-1" trigger="Nested Accordion 1">
            <p>Content for nested accordion 1</p>
          </Accordion>
          <Accordion id="child-2" trigger="Nested Accordion 2">
            <p>Content for nested accordion 2</p>
          </Accordion>
        </div>
      </div>
    </Accordion>
  ),
};
