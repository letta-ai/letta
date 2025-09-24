import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Typography, LoadedTypography } from './Typography';

describe('Typography', () => {
  describe('Basic Rendering', () => {
    it('renders with children text', () => {
      render(<Typography>Hello World</Typography>);
      expect(screen.getByText('Hello World')).toBeInTheDocument();
    });

    it('renders with default variant and color', () => {
      render(<Typography>Default Text</Typography>);
      const element = screen.getByText('Default Text');
      expect(element).toHaveClass('text-base');
      expect(element).toHaveClass('text-text-default');
    });

    it('renders as p element by default', () => {
      render(<Typography>Paragraph Text</Typography>);
      const element = screen.getByText('Paragraph Text');
      expect(element.tagName).toBe('P');
    });
  });

  describe('Variants', () => {
    it('renders heading1 variant', () => {
      render(<Typography variant="heading1">Heading 1</Typography>);
      const element = screen.getByText('Heading 1');
      expect(element).toHaveClass('text-[1.8rem]');
      expect(element).toHaveClass('font-semibold');
      expect(element.tagName).toBe('H1');
    });

    it('renders heading2 variant', () => {
      render(<Typography variant="heading2">Heading 2</Typography>);
      const element = screen.getByText('Heading 2');
      expect(element).toHaveClass('text-[1.725rem]');
      expect(element).toHaveClass('font-semibold');
      expect(element.tagName).toBe('H2');
    });

    it('renders heading3 variant', () => {
      render(<Typography variant="heading3">Heading 3</Typography>);
      const element = screen.getByText('Heading 3');
      expect(element).toHaveClass('text-[1.5rem]');
      expect(element).toHaveClass('font-semibold');
      expect(element.tagName).toBe('H3');
    });

    it('renders heading4 variant', () => {
      render(<Typography variant="heading4">Heading 4</Typography>);
      const element = screen.getByText('Heading 4');
      expect(element).toHaveClass('text-xl');
      expect(element).toHaveClass('font-semibold');
      expect(element.tagName).toBe('H4');
    });

    it('renders heading5 variant', () => {
      render(<Typography variant="heading5">Heading 5</Typography>);
      const element = screen.getByText('Heading 5');
      expect(element).toHaveClass('text-lg');
      expect(element).toHaveClass('font-semibold');
      expect(element.tagName).toBe('H5');
    });

    it('renders heading6 variant', () => {
      render(<Typography variant="heading6">Heading 6</Typography>);
      const element = screen.getByText('Heading 6');
      expect(element).toHaveClass('text-lg');
      expect(element.tagName).toBe('H6');
    });

    it('renders body variant', () => {
      render(<Typography variant="body">Body Text</Typography>);
      const element = screen.getByText('Body Text');
      expect(element).toHaveClass('text-base');
      expect(element.tagName).toBe('P');
    });

    it('renders body2 variant', () => {
      render(<Typography variant="body2">Body2 Text</Typography>);
      const element = screen.getByText('Body2 Text');
      expect(element).toHaveClass('text-sm');
      expect(element.tagName).toBe('P');
    });

    it('renders body3 variant', () => {
      render(<Typography variant="body3">Body3 Text</Typography>);
      const element = screen.getByText('Body3 Text');
      expect(element).toHaveClass('text-xs');
      expect(element.tagName).toBe('P');
    });

    it('renders body4 variant', () => {
      render(<Typography variant="body4">Body4 Text</Typography>);
      const element = screen.getByText('Body4 Text');
      expect(element).toHaveClass('text-[0.625rem]');
      expect(element).toHaveClass('tracking-[0.04em]');
      expect(element.tagName).toBe('P');
    });

    it('renders large variant', () => {
      render(<Typography variant="large">Large Text</Typography>);
      const element = screen.getByText('Large Text');
      expect(element).toHaveClass('text-lg');
      expect(element).toHaveClass('leading-7');
    });

    it('renders panelInfo variant', () => {
      render(<Typography variant="panelInfo">Panel Info</Typography>);
      const element = screen.getByText('Panel Info');
      expect(element).toHaveClass('text-lg');
      expect(element.tagName).toBe('P');
    });
  });

  describe('Colors', () => {
    it('applies default color', () => {
      render(<Typography color="default">Default Color</Typography>);
      expect(screen.getByText('Default Color')).toHaveClass(
        'text-text-default',
      );
    });

    it('applies black color', () => {
      render(<Typography color="black">Black Color</Typography>);
      expect(screen.getByText('Black Color')).toHaveClass('text-black');
    });

    it('applies muted color', () => {
      render(<Typography color="muted">Muted Color</Typography>);
      expect(screen.getByText('Muted Color')).toHaveClass('text-muted');
    });

    it('applies white color', () => {
      render(<Typography color="white">White Color</Typography>);
      expect(screen.getByText('White Color')).toHaveClass('text-white');
    });

    it('applies positive color', () => {
      render(<Typography color="positive">Positive Color</Typography>);
      expect(screen.getByText('Positive Color')).toHaveClass('text-positive');
    });

    it('applies destructive color', () => {
      render(<Typography color="destructive">Destructive Color</Typography>);
      expect(screen.getByText('Destructive Color')).toHaveClass(
        'text-destructive',
      );
    });

    it('applies lighter color', () => {
      render(<Typography color="lighter">Lighter Color</Typography>);
      expect(screen.getByText('Lighter Color')).toHaveClass(
        'text-text-lighter',
      );
    });

    it('applies violet color', () => {
      render(<Typography color="violet">Violet Color</Typography>);
      expect(screen.getByText('Violet Color')).toHaveClass('text-violet');
    });
  });

  describe('Font Families', () => {
    it('applies default font', () => {
      render(<Typography font="default">Default Font</Typography>);
      expect(screen.getByText('Default Font')).toHaveClass('font-sans');
    });

    it('applies mono font', () => {
      render(<Typography font="mono">Mono Font</Typography>);
      expect(screen.getByText('Mono Font')).toHaveClass('font-mono');
    });
  });

  describe('Text Styling', () => {
    it('applies bold styling', () => {
      render(<Typography bold>Bold Text</Typography>);
      expect(screen.getByText('Bold Text')).toHaveClass('font-semibold');
    });

    it('applies semibold styling', () => {
      render(<Typography semibold>Semibold Text</Typography>);
      expect(screen.getByText('Semibold Text')).toHaveClass('font-medium');
    });

    it('applies italic styling', () => {
      render(<Typography italic>Italic Text</Typography>);
      expect(screen.getByText('Italic Text')).toHaveClass('italic');
    });

    it('applies underline styling', () => {
      render(<Typography underline>Underlined Text</Typography>);
      expect(screen.getByText('Underlined Text')).toHaveClass('underline');
    });

    it('applies uppercase styling', () => {
      render(<Typography uppercase>Uppercase Text</Typography>);
      expect(screen.getByText('Uppercase Text')).toHaveClass('uppercase');
    });

    it('applies multiple styles together', () => {
      render(
        <Typography bold italic underline>
          Multi-styled Text
        </Typography>,
      );
      const element = screen.getByText('Multi-styled Text');
      expect(element).toHaveClass('font-semibold');
      expect(element).toHaveClass('italic');
      expect(element).toHaveClass('underline');
    });
  });

  describe('Layout and Display', () => {
    it('applies inline display', () => {
      render(<Typography inline>Inline Text</Typography>);
      expect(screen.getByText('Inline Text')).toHaveClass('inline');
    });

    it('applies full width', () => {
      render(<Typography fullWidth>Full Width Text</Typography>);
      expect(screen.getByText('Full Width Text')).toHaveClass('w-full');
    });

    it('applies no wrap', () => {
      render(<Typography noWrap>No Wrap Text</Typography>);
      expect(screen.getByText('No Wrap Text')).toHaveClass('whitespace-nowrap');
    });

    it('applies overflow ellipsis', () => {
      render(<Typography overflow="ellipsis">Overflow Text</Typography>);
      const element = screen.getByText('Overflow Text');
      expect(element).toHaveClass('overflow-ellipsis');
      expect(element).toHaveClass('overflow-hidden');
    });
  });

  describe('Alignment', () => {
    it('applies left alignment', () => {
      render(<Typography align="left">Left Aligned</Typography>);
      expect(screen.getByText('Left Aligned')).toHaveClass('text-left');
    });

    it('applies center alignment', () => {
      render(<Typography align="center">Center Aligned</Typography>);
      expect(screen.getByText('Center Aligned')).toHaveClass('text-center');
    });

    it('applies right alignment', () => {
      render(<Typography align="right">Right Aligned</Typography>);
      expect(screen.getByText('Right Aligned')).toHaveClass('text-right');
    });
  });

  describe('Element Override', () => {
    it('overrides element to h1', () => {
      render(<Typography overrideEl="h1">Override H1</Typography>);
      expect(screen.getByText('Override H1').tagName).toBe('H1');
    });

    it('overrides element to span', () => {
      render(<Typography overrideEl="span">Override Span</Typography>);
      expect(screen.getByText('Override Span').tagName).toBe('SPAN');
    });

    it('overrides element to li', () => {
      render(<Typography overrideEl="li">Override Li</Typography>);
      expect(screen.getByText('Override Li').tagName).toBe('LI');
    });

    it('overrides heading variant to p element', () => {
      render(
        <Typography variant="heading1" overrideEl="p">
          H1 as P
        </Typography>,
      );
      const element = screen.getByText('H1 as P');
      expect(element.tagName).toBe('P');
      expect(element).toHaveClass('text-[1.8rem]');
    });
  });

  describe('HTML Props', () => {
    it('applies additional HTML attributes', () => {
      render(
        <Typography id="test-id" data-testid="custom-test-id">
          With Props
        </Typography>,
      );
      const element = screen.getByTestId('custom-test-id');
      expect(element).toHaveAttribute('id', 'test-id');
    });

    it('applies onClick handler', () => {
      const handleClick = jest.fn();
      render(<Typography onClick={handleClick}>Clickable Text</Typography>);
      const element = screen.getByText('Clickable Text');
      element.click();
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('applies style prop', () => {
      render(
        <Typography style={{ marginTop: '20px' }}>Styled Text</Typography>,
      );
      const element = screen.getByText('Styled Text');
      expect(element).toHaveStyle({ marginTop: '20px' });
    });
  });

  describe('LoadedTypography', () => {
    it('shows placeholder when text is null', () => {
      render(<LoadedTypography fillerText="Loading..." text={null} />);
      const element = screen.getByText('Loading...');
      expect(element).toHaveClass('bg-background-grey2');
      expect(element).toHaveClass('text-transparent');
      expect(element).toHaveClass('animate-pulse');
      expect(element).toHaveAttribute('role', 'presentation');
      expect(element).toHaveAttribute('tabIndex', '-1');
    });

    it('shows placeholder when text is undefined', () => {
      render(<LoadedTypography fillerText="Loading..." text={undefined} />);
      const element = screen.getByText('Loading...');
      expect(element).toHaveClass('bg-background-grey2');
    });

    it('shows actual text when provided', () => {
      render(<LoadedTypography fillerText="Loading..." text="Actual Text" />);
      expect(screen.getByText('Actual Text')).toBeInTheDocument();
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    it('shows text even if empty string', () => {
      render(<LoadedTypography fillerText="Loading..." text="" />);
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    it('passes typography props to underlying component', () => {
      render(
        <LoadedTypography
          fillerText="Loading..."
          text="Loaded"
          variant="heading1"
          color="positive"
          bold
        />,
      );
      const element = screen.getByText('Loaded');
      expect(element).toHaveClass('text-[1.8rem]');
      expect(element).toHaveClass('text-positive');
      expect(element).toHaveClass('font-semibold');
    });
  });
});
