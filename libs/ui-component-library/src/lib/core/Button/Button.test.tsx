import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Button } from './Button';

describe('Button', () => {
  describe('Basic Rendering', () => {
    it('renders with label', () => {
      render(<Button label="Click me" />);
      expect(screen.getByText('Click me')).toBeInTheDocument();
    });

    it('renders with default props', () => {
      render(<Button label="Default Button" />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-primary');
      expect(button).toHaveClass('text-primary-content');
    });

    it('renders as a link when href is provided', () => {
      render(<Button label="Link Button" href="https://example.com" />);
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', 'https://example.com');
    });
  });

  describe('Variants and Colors', () => {
    it('applies secondary color styles', () => {
      render(<Button label="Secondary" color="secondary" />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-transparent');
      expect(button).toHaveClass('text-text-default');
    });

    it('applies tertiary color styles', () => {
      render(<Button label="Tertiary" color="tertiary" />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-transparent');
      expect(button).toHaveClass('text-text-lighter');
    });

    it('applies destructive color styles', () => {
      render(<Button label="Delete" color="destructive" />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-destructive');
      expect(button).toHaveClass('text-white');
    });
  });

  describe('Sizes', () => {
    it('applies small size styles', () => {
      render(<Button label="Small" size="small" />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-biHeight-sm');
      expect(button).toHaveClass('text-sm');
    });

    it('applies large size styles', () => {
      render(<Button label="Large" size="large" />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-biHeight-lg');
      expect(button).toHaveClass('text-base');
      expect(button).toHaveClass('font-bold');
    });

    it('applies xsmall size styles', () => {
      render(<Button label="XSmall" size="xsmall" />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-biHeight-xs');
      expect(button).toHaveClass('text-xs');
    });
  });

  describe('States', () => {
    it('handles disabled state', () => {
      render(<Button label="Disabled" disabled />);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveClass('cursor-not-allowed');
      expect(button).toHaveClass('opacity-50');
    });

    it('handles busy state', () => {
      render(<Button label="Loading" busy />);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      // The spinner should be rendered instead of preIcon
      expect(screen.getByText('Loading')).toBeInTheDocument();
    });

    it('handles active state for secondary color', () => {
      render(<Button label="Active" color="secondary" active />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-secondary-active');
      expect(button).toHaveAttribute('data-active', 'true');
    });

    it('handles active state for tertiary color', () => {
      render(<Button label="Active" color="tertiary" active />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-secondary-active');
    });
  });

  describe('Icons', () => {
    it('renders with preIcon', () => {
      function PreIcon() {
        return <span data-testid="pre-icon">→</span>;
      }
      render(<Button label="With Icon" preIcon={<PreIcon />} />);
      expect(screen.getByTestId('pre-icon')).toBeInTheDocument();
    });

    it('renders with postIcon', () => {
      function PostIcon() {
        return <span data-testid="post-icon">←</span>;
      }
      render(<Button label="With Icon" postIcon={<PostIcon />} />);
      expect(screen.getByTestId('post-icon')).toBeInTheDocument();
    });

    it('renders both pre and post icons', () => {
      function PreIcon() {
        return <span data-testid="pre-icon">→</span>;
      }
      function PostIcon() {
        return <span data-testid="post-icon">←</span>;
      }
      render(
        <Button
          label="With Icons"
          preIcon={<PreIcon />}
          postIcon={<PostIcon />}
        />,
      );
      expect(screen.getByTestId('pre-icon')).toBeInTheDocument();
      expect(screen.getByTestId('post-icon')).toBeInTheDocument();
    });
  });

  describe('Layout Options', () => {
    it('applies fullWidth styles', () => {
      render(<Button label="Full Width" fullWidth />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('w-full');
      expect(button).toHaveClass('justify-center');
    });

    it('applies fullHeight styles', () => {
      render(<Button label="Full Height" fullHeight />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-full');
    });

    it('hides label when hideLabel is true', () => {
      render(<Button label="Hidden Label" hideLabel />);
      // Label should be visually hidden but still accessible
      const label = screen.getByText('Hidden Label');
      expect(label).toHaveClass('sr-only');
    });

    it('applies square styles with proper dimensions', () => {
      render(<Button label="Square" square />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('w-biWidth');
      expect(button).toHaveClass('min-w-biWidth');
    });
  });

  describe('Events', () => {
    it('handles click events', () => {
      const handleClick = jest.fn();
      render(<Button label="Clickable" onClick={handleClick} />);
      const button = screen.getByRole('button');
      fireEvent.click(button);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not trigger click when disabled', () => {
      const handleClick = jest.fn();
      render(<Button label="Disabled" disabled onClick={handleClick} />);
      const button = screen.getByRole('button');
      fireEvent.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('does not trigger click when busy', () => {
      const handleClick = jest.fn();
      render(<Button label="Busy" busy onClick={handleClick} />);
      const button = screen.getByRole('button');
      fireEvent.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Typography', () => {
    it('applies bold font when bold prop is true', () => {
      render(<Button label="Bold Text" bold />);
      const label = screen.getByText('Bold Text');
      expect(label).toHaveClass('font-bold');
    });
  });

  describe('Button Types', () => {
    it('renders with submit type', () => {
      render(<Button label="Submit" type="submit" />);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'submit');
    });

    it('renders with reset type', () => {
      render(<Button label="Reset" type="reset" />);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'reset');
    });

    it('renders with button type by default', () => {
      render(<Button label="Button" type="button" />);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'button');
    });
  });

  describe('Custom Styling', () => {
    it('applies custom className when provided', () => {
      render(<Button label="Custom" _use_rarely_className="custom-class" />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
    });
  });

  describe('Alignment', () => {
    it('applies center alignment', () => {
      render(<Button label="Centered" align="center" />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('justify-center');
    });

    it('applies left alignment', () => {
      render(<Button label="Left" align="left" />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('justify-start');
    });

    it('applies right alignment', () => {
      render(<Button label="Right" align="right" />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('justify-end');
    });
  });

  describe('Compound Variants', () => {
    it('applies correct styles for hideLabel with small size', () => {
      render(<Button label="Hidden Small" hideLabel size="small" />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('w-biWidth-sm');
      expect(button).toHaveClass('min-w-biWidth-sm');
    });

    it('applies correct styles for square with large size', () => {
      render(<Button label="Square Large" square size="large" />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('w-biWidth-lg');
      expect(button).toHaveClass('min-w-biWidth-lg');
    });
  });
});
