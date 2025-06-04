import type { Meta, StoryObj } from '@storybook/react';
import { Typography, LoadedTypography } from './Typography';
import React from 'react';

const meta: Meta<typeof Typography> = {
  component: Typography,
  title: 'Core/Typography',
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    children: {
      description: 'The text content to display',
      control: { type: 'text' },
    },
    variant: {
      description: 'The typography variant',
      options: [
        'heading1',
        'heading2',
        'heading3',
        'heading4',
        'heading5',
        'heading6',
        'panelInfo',
        'large',
        'body',
        'body2',
        'body3',
        'body4',
      ],
      control: { type: 'select' },
    },
    color: {
      description: 'The text color',
      options: [
        'default',
        'black',
        'muted',
        'white',
        'positive',
        'destructive',
        'lighter',
        'violet',
      ],
      control: { type: 'select' },
    },
    font: {
      description: 'The font family',
      options: ['default', 'mono'],
      control: { type: 'radio' },
    },
    align: {
      description: 'Text alignment',
      options: ['left', 'center', 'right'],
      control: { type: 'radio' },
    },
    bold: {
      description: 'Make text bold',
      control: { type: 'boolean' },
    },
    semibold: {
      description: 'Make text semibold',
      control: { type: 'boolean' },
    },
    italic: {
      description: 'Make text italic',
      control: { type: 'boolean' },
    },
    underline: {
      description: 'Underline text',
      control: { type: 'boolean' },
    },
    uppercase: {
      description: 'Transform text to uppercase',
      control: { type: 'boolean' },
    },
    inline: {
      description: 'Display as inline element',
      control: { type: 'boolean' },
    },
    noWrap: {
      description: 'Prevent text wrapping',
      control: { type: 'boolean' },
    },
    fullWidth: {
      description: 'Take full width of container',
      control: { type: 'boolean' },
    },
    overflow: {
      description: 'Text overflow behavior',
      options: [undefined, 'ellipsis'],
      control: { type: 'radio' },
    },
    overrideEl: {
      description: 'Override the default HTML element',
      options: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'p', 'span'],
      control: { type: 'select' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Typography>;

// Base story with all controls
export const Playground: Story = {
  args: {
    children: 'The quick brown fox jumps over the lazy dog',
    variant: 'body',
    color: 'default',
    align: 'left',
    bold: false,
    semibold: false,
    italic: false,
    underline: false,
    uppercase: false,
    inline: false,
    noWrap: false,
    fullWidth: false,
  },
};

// Heading variants
export const HeadingVariants: Story = {
  render: function AllHeadings() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Typography variant="heading1">
          Heading 1 - The quick brown fox
        </Typography>
        <Typography variant="heading2">
          Heading 2 - The quick brown fox
        </Typography>
        <Typography variant="heading3">
          Heading 3 - The quick brown fox
        </Typography>
        <Typography variant="heading4">
          Heading 4 - The quick brown fox
        </Typography>
        <Typography variant="heading5">
          Heading 5 - The quick brown fox
        </Typography>
        <Typography variant="heading6">
          Heading 6 - The quick brown fox
        </Typography>
      </div>
    );
  },
};

// Body variants
export const BodyVariants: Story = {
  render: function AllBodyVariants() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Typography variant="large">
          Large - The quick brown fox jumps over the lazy dog
        </Typography>
        <Typography variant="body">
          Body - The quick brown fox jumps over the lazy dog
        </Typography>
        <Typography variant="body2">
          Body2 - The quick brown fox jumps over the lazy dog
        </Typography>
        <Typography variant="body3">
          Body3 - The quick brown fox jumps over the lazy dog
        </Typography>
        <Typography variant="body4">
          Body4 - The quick brown fox jumps over the lazy dog
        </Typography>
        <Typography variant="panelInfo">
          Panel Info - The quick brown fox jumps over the lazy dog
        </Typography>
      </div>
    );
  },
};

// Color variants
export const ColorVariants: Story = {
  render: function AllColors() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <Typography color="default">Default color text</Typography>
        <Typography color="black">Black color text</Typography>
        <Typography color="muted">Muted color text</Typography>
        <div style={{ background: '#333', padding: '8px' }}>
          <Typography color="white">White color text</Typography>
        </div>
        <Typography color="positive">Positive color text</Typography>
        <Typography color="destructive">Destructive color text</Typography>
        <Typography color="lighter">Lighter color text</Typography>
        <Typography color="violet">Violet color text</Typography>
      </div>
    );
  },
};

// Font families
export const FontFamilies: Story = {
  render: function FontComparison() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Typography font="default" variant="large">
          Default Font: The quick brown fox jumps over the lazy dog
        </Typography>
        <Typography font="mono" variant="large">
          Monospace Font: The quick brown fox jumps over the lazy dog
        </Typography>
        <Typography font="mono" variant="body">
          const greeting = "Hello, World!";
        </Typography>
      </div>
    );
  },
};

// Text styling
export const TextStyling: Story = {
  render: function StyledText() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Typography bold>Bold text example</Typography>
        <Typography semibold>Semibold text example</Typography>
        <Typography italic>Italic text example</Typography>
        <Typography underline>Underlined text example</Typography>
        <Typography uppercase>uppercase text example</Typography>
        <Typography bold italic underline>
          Combined bold, italic, and underlined text
        </Typography>
      </div>
    );
  },
};

// Alignment
export const Alignment: Story = {
  render: function TextAlignment() {
    return (
      <div
        style={{
          width: '400px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ border: '1px solid #e0e0e0', padding: '16px' }}>
          <Typography align="left">Left aligned text</Typography>
        </div>
        <div style={{ border: '1px solid #e0e0e0', padding: '16px' }}>
          <Typography align="center">Center aligned text</Typography>
        </div>
        <div style={{ border: '1px solid #e0e0e0', padding: '16px' }}>
          <Typography align="right">Right aligned text</Typography>
        </div>
      </div>
    );
  },
};

// Overflow handling
export const OverflowHandling: Story = {
  render: function TextOverflow() {
    const longText =
      'This is a very long text that will demonstrate how the overflow ellipsis works when the text is too long to fit in the container';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div
          style={{
            width: '300px',
            border: '1px solid #e0e0e0',
            padding: '16px',
          }}
        >
          <Typography>Normal overflow (wrapping):</Typography>
          <Typography variant="body2">{longText}</Typography>
        </div>
        <div
          style={{
            width: '300px',
            border: '1px solid #e0e0e0',
            padding: '16px',
          }}
        >
          <Typography>With ellipsis and no wrap:</Typography>
          <Typography variant="body2" overflow="ellipsis" noWrap>
            {longText}
          </Typography>
        </div>
      </div>
    );
  },
};

// Element override
export const ElementOverride: Story = {
  render: function OverriddenElements() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Typography variant="body" overrideEl="h1">
          Body variant rendered as h1 element
        </Typography>
        <Typography variant="heading1" overrideEl="p">
          Heading1 variant rendered as p element
        </Typography>
        <ul>
          <Typography variant="body" overrideEl="li">
            List item using Typography
          </Typography>
          <Typography variant="body" overrideEl="li">
            Another list item
          </Typography>
        </ul>
      </div>
    );
  },
};

// Inline usage
export const InlineUsage: Story = {
  render: function InlineExample() {
    return (
      <div>
        <Typography inline>This is inline text</Typography>
        <Typography inline color="positive" bold>
          {' '}
          with highlighted{' '}
        </Typography>
        <Typography inline>parts in the same line.</Typography>
        <br />
        <br />
        <Typography>
          Regular paragraph with{' '}
          <Typography inline color="destructive" underline>
            inline error text
          </Typography>{' '}
          inside.
        </Typography>
      </div>
    );
  },
};

// LoadedTypography examples
export const LoadedTypographyExample: Story = {
  render: function LoadingStates() {
    const [isLoaded, setIsLoaded] = React.useState(false);

    function handleToggle() {
      setIsLoaded(!isLoaded);
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <button onClick={handleToggle} style={{ marginBottom: '16px' }}>
          Toggle Loading State
        </button>

        <LoadedTypography
          variant="heading3"
          fillerText="Loading heading..."
          text={isLoaded ? 'Loaded Heading Text' : null}
        />

        <LoadedTypography
          variant="body"
          fillerText="Lorem ipsum dolor sit amet, consectetur adipiscing elit."
          text={
            isLoaded
              ? 'This is the actual loaded content that replaces the placeholder.'
              : null
          }
        />

        <LoadedTypography
          variant="body2"
          color="muted"
          fillerText="Loading description..."
          text={isLoaded ? 'Additional information has been loaded.' : null}
        />
      </div>
    );
  },
};

// Real-world examples
export const RealWorldExamples: Story = {
  render: function PracticalUsage() {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '32px',
          maxWidth: '600px',
        }}
      >
        {/* Card example */}
        <div
          style={{
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            padding: '24px',
          }}
        >
          <Typography variant="heading4">Card Title</Typography>
          <Typography
            variant="body2"
            color="muted"
            style={{ marginTop: '8px' }}
          >
            Published on December 1, 2023
          </Typography>
          <Typography variant="body" style={{ marginTop: '16px' }}>
            This is a card component using various typography styles. It
            demonstrates how different variants and colors work together.
          </Typography>
          <Typography
            variant="body2"
            color="positive"
            style={{ marginTop: '16px' }}
          >
            Status: Active
          </Typography>
        </div>

        {/* Form example */}
        <div>
          <Typography variant="heading5" style={{ marginBottom: '16px' }}>
            User Settings
          </Typography>
          <div style={{ marginBottom: '16px' }}>
            <Typography variant="body2" bold style={{ marginBottom: '4px' }}>
              Username
            </Typography>
            <Typography variant="body" color="muted">
              john.doe@example.com
            </Typography>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <Typography variant="body2" bold style={{ marginBottom: '4px' }}>
              Account Type
            </Typography>
            <Typography variant="body" color="violet">
              Premium
            </Typography>
          </div>
        </div>

        {/* Error message */}
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '4px',
            padding: '16px',
          }}
        >
          <Typography variant="body2" color="destructive" bold>
            Error: Invalid input
          </Typography>
          <Typography
            variant="body3"
            color="destructive"
            style={{ marginTop: '4px' }}
          >
            Please enter a valid email address
          </Typography>
        </div>
      </div>
    );
  },
};

// Typography scale comparison
export const TypographyScale: Story = {
  render: function ScaleComparison() {
    const text = 'Ag';

    return (
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '24px' }}>
        <div style={{ textAlign: 'center' }}>
          <Typography variant="heading1">{text}</Typography>
          <Typography variant="body3" color="muted">
            H1
          </Typography>
        </div>
        <div style={{ textAlign: 'center' }}>
          <Typography variant="heading2">{text}</Typography>
          <Typography variant="body3" color="muted">
            H2
          </Typography>
        </div>
        <div style={{ textAlign: 'center' }}>
          <Typography variant="heading3">{text}</Typography>
          <Typography variant="body3" color="muted">
            H3
          </Typography>
        </div>
        <div style={{ textAlign: 'center' }}>
          <Typography variant="heading4">{text}</Typography>
          <Typography variant="body3" color="muted">
            H4
          </Typography>
        </div>
        <div style={{ textAlign: 'center' }}>
          <Typography variant="heading5">{text}</Typography>
          <Typography variant="body3" color="muted">
            H5
          </Typography>
        </div>
        <div style={{ textAlign: 'center' }}>
          <Typography variant="heading6">{text}</Typography>
          <Typography variant="body3" color="muted">
            H6
          </Typography>
        </div>
        <div style={{ textAlign: 'center' }}>
          <Typography variant="large">{text}</Typography>
          <Typography variant="body3" color="muted">
            Large
          </Typography>
        </div>
        <div style={{ textAlign: 'center' }}>
          <Typography variant="body">{text}</Typography>
          <Typography variant="body3" color="muted">
            Body
          </Typography>
        </div>
        <div style={{ textAlign: 'center' }}>
          <Typography variant="body2">{text}</Typography>
          <Typography variant="body3" color="muted">
            Body2
          </Typography>
        </div>
        <div style={{ textAlign: 'center' }}>
          <Typography variant="body3">{text}</Typography>
          <Typography variant="body3" color="muted">
            Body3
          </Typography>
        </div>
      </div>
    );
  },
};
