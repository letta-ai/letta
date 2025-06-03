import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';
import React from 'react';

// Sample icon components for demonstration
function ChevronRightIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M6 12L10 8L6 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M8 3V13M3 8H13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M2 4H14M5 4V2C5 1.44772 5.44772 1 6 1H10C10.5523 1 11 1.44772 11 2V4M6 7V11M10 7V11M3 4L4 13C4 13.5523 4.44772 14 5 14H11C11.5523 14 12 13.5523 12 13L13 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DownloadIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M8 2V10M8 10L5 7M8 10L11 7M2 14H14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const meta: Meta<typeof Button> = {
  component: Button,
  title: 'Core/Button',
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    label: {
      description: 'The text content of the button',
      control: { type: 'text' },
    },
    color: {
      description: 'The color scheme of the button',
      options: [
        'primary',
        'secondary',
        'tertiary',
        'destructive',
        'brand',
        'black',
      ],
      control: { type: 'select' },
    },
    variant: {
      description: 'The button variant style',
      options: ['default'],
      control: { type: 'radio' },
    },
    size: {
      description: 'The size of the button',
      options: ['xsmall', 'small', 'default', 'large'],
      control: { type: 'select' },
    },
    align: {
      description: 'The alignment of button content',
      options: ['left', 'center', 'right'],
      control: { type: 'radio' },
    },
    fullWidth: {
      description: 'Whether the button should take full width of its container',
      control: { type: 'boolean' },
    },
    fullHeight: {
      description:
        'Whether the button should take full height of its container',
      control: { type: 'boolean' },
    },
    hideLabel: {
      description: 'Hide the button label (accessible via screen reader)',
      control: { type: 'boolean' },
    },
    square: {
      description: 'Make the button square shaped',
      control: { type: 'boolean' },
    },
    active: {
      description: 'The active/selected state of the button',
      control: { type: 'boolean' },
    },
    busy: {
      description: 'Show loading state',
      control: { type: 'boolean' },
    },
    disabled: {
      description: 'Disable the button',
      control: { type: 'boolean' },
    },
    bold: {
      description: 'Make the button text bold',
      control: { type: 'boolean' },
    },
    animate: {
      description: 'Enable transition animations',
      control: { type: 'boolean' },
    },
    tooltipPlacement: {
      description: 'Tooltip placement (only when label is hidden)',
      options: ['top', 'right', 'bottom', 'left'],
      control: { type: 'radio' },
    },
    href: {
      description: 'If provided, renders as an anchor tag',
      control: { type: 'text' },
    },
    target: {
      description: 'Target attribute for anchor buttons',
      control: { type: 'text' },
    },
    type: {
      description: 'HTML button type attribute',
      options: ['button', 'submit', 'reset'],
      control: { type: 'radio' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

// Base story with all controls
export const Playground: Story = {
  args: {
    label: 'Button',
    color: 'primary',
    variant: 'default',
    size: 'default',
    fullWidth: false,
    fullHeight: false,
    hideLabel: false,
    active: false,
    busy: false,
    disabled: false,
    bold: false,
    animate: true,
    tooltipPlacement: 'top',
  },
};

// Color variants
export const PrimaryButton: Story = {
  args: {
    label: 'Primary Action',
    color: 'primary',
  },
};

export const SecondaryButton: Story = {
  args: {
    label: 'Secondary Action',
    color: 'secondary',
  },
};

export const TertiaryButton: Story = {
  args: {
    label: 'Tertiary Action',
    color: 'tertiary',
  },
};

export const DestructiveButton: Story = {
  args: {
    label: 'Delete Item',
    color: 'destructive',
    preIcon: <TrashIcon />,
  },
};

export const BrandButton: Story = {
  args: {
    label: 'Brand Action',
    color: 'brand',
  },
};

export const BlackButton: Story = {
  args: {
    label: 'Black Button',
    color: 'black',
  },
};

// Size variants
export const SizeVariants: Story = {
  render: function ButtonSizes() {
    return (
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        <Button label="XSmall" size="xsmall" />
        <Button label="Small" size="small" />
        <Button label="Default" size="default" />
        <Button label="Large" size="large" />
      </div>
    );
  },
};

// With icons
export const WithPreIcon: Story = {
  args: {
    label: 'Download',
    preIcon: <DownloadIcon />,
  },
};

export const WithPostIcon: Story = {
  args: {
    label: 'Next',
    postIcon: <ChevronRightIcon />,
  },
};

export const WithBothIcons: Story = {
  args: {
    label: 'Create New',
    preIcon: <PlusIcon />,
    postIcon: <ChevronRightIcon />,
  },
};

// Icon only buttons
export const IconOnly: Story = {
  args: {
    label: 'Add',
    preIcon: <PlusIcon />,
    hideLabel: true,
    square: true,
    tooltipPlacement: 'top',
  },
};

export const IconOnlySizes: Story = {
  render: function IconButtonSizes() {
    return (
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        <Button
          label="Delete"
          preIcon={<TrashIcon />}
          hideLabel
          square
          size="xsmall"
          color="destructive"
        />
        <Button
          label="Delete"
          preIcon={<TrashIcon />}
          hideLabel
          square
          size="small"
          color="destructive"
        />
        <Button
          label="Delete"
          preIcon={<TrashIcon />}
          hideLabel
          square
          size="default"
          color="destructive"
        />
        <Button
          label="Delete"
          preIcon={<TrashIcon />}
          hideLabel
          square
          size="large"
          color="destructive"
        />
      </div>
    );
  },
};

// States
export const LoadingState: Story = {
  args: {
    label: 'Saving...',
    busy: true,
  },
};

export const DisabledState: Story = {
  args: {
    label: 'Disabled Button',
    disabled: true,
  },
};

export const ActiveState: Story = {
  args: {
    label: 'Active/Selected',
    active: true,
  },
};

// Button states comparison
export const StatesComparison: Story = {
  render: function ButtonStates() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Button label="Default" />
          <Button label="Hover me" />
          <Button label="Active" active />
          <Button label="Disabled" disabled />
          <Button label="Loading" busy />
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Button label="Default" color="secondary" />
          <Button label="Hover me" color="secondary" />
          <Button label="Active" color="secondary" active />
          <Button label="Disabled" color="secondary" disabled />
          <Button label="Loading" color="secondary" busy />
        </div>
      </div>
    );
  },
};

// Layout variants
export const FullWidth: Story = {
  args: {
    label: 'Full Width Button',
    fullWidth: true,
  },
  decorators: [
    function Wrapper(Story) {
      return (
        <div style={{ width: '400px' }}>
          <Story />
        </div>
      );
    },
  ],
};

export const ButtonGroup: Story = {
  render: function ButtonGroupExample() {
    return (
      <div style={{ display: 'flex', gap: '8px' }}>
        <Button label="Save" color="primary" />
        <Button label="Save and Continue" color="secondary" />
        <Button label="Cancel" color="tertiary" />
      </div>
    );
  },
};

// Link buttons
export const LinkButton: Story = {
  args: {
    label: 'Visit Documentation',
    href: 'https://example.com',
    target: '_blank',
    postIcon: <ChevronRightIcon />,
  },
};

// Alignment examples
export const AlignmentVariants: Story = {
  render: function ButtonAlignments() {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          width: '300px',
        }}
      >
        <Button
          label="Left Aligned"
          align="left"
          fullWidth
          preIcon={<PlusIcon />}
        />
        <Button
          label="Center Aligned"
          align="center"
          fullWidth
          preIcon={<PlusIcon />}
        />
        <Button
          label="Right Aligned"
          align="right"
          fullWidth
          preIcon={<PlusIcon />}
        />
      </div>
    );
  },
};

// Form buttons
export const FormButtons: Story = {
  render: function FormButtonExample() {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          alert('Form submitted!');
        }}
      >
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button label="Submit" type="submit" color="primary" />
          <Button label="Reset" type="reset" color="secondary" />
          <Button label="Cancel" type="button" color="tertiary" />
        </div>
      </form>
    );
  },
};

// Complex example
export const RealWorldExample: Story = {
  render: function ComplexButtonExample() {
    const [isLoading, setIsLoading] = React.useState(false);
    const [isActive, setIsActive] = React.useState(false);

    function handleClick() {
      setIsLoading(true);
      setTimeout(() => {
        setIsLoading(false);
        setIsActive(!isActive);
      }, 2000);
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div>
          <h3 style={{ marginBottom: '16px' }}>Interactive Example</h3>
          <Button
            label={isActive ? 'Deactivate' : 'Activate'}
            onClick={handleClick}
            busy={isLoading}
            active={isActive}
            color={isActive ? 'secondary' : 'primary'}
            preIcon={isActive ? <TrashIcon /> : <PlusIcon />}
          />
        </div>

        <div>
          <h3 style={{ marginBottom: '16px' }}>Common Patterns</h3>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <Button label="Create New" color="primary" preIcon={<PlusIcon />} />
            <Button
              label="Download Report"
              color="secondary"
              preIcon={<DownloadIcon />}
            />
            <Button
              label="Delete Selected"
              color="destructive"
              preIcon={<TrashIcon />}
              disabled
            />
            <Button
              label="View Details"
              color="tertiary"
              postIcon={<ChevronRightIcon />}
            />
          </div>
        </div>
      </div>
    );
  },
};
