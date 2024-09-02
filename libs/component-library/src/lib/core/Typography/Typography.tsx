import type { HTMLProps } from 'react';
import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@letta-web/core-style-config';

const typographyVariants = cva('text-content', {
  variants: {
    variant: {
      heading1: 'text-xl font-medium',
      body: 'text-base',
    },
    color: {
      default: '',
      black: 'text-black',
      primary: 'text-primary',
      muted: 'text-muted',
      white: 'text-white',
    },
    bold: {
      true: 'font-semibold',
    },
  },
  defaultVariants: {
    variant: 'body',
    color: 'default',
  },
});

type TypographyProps = HTMLProps<HTMLElement> &
  VariantProps<typeof typographyVariants> & {
    overrideEl?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p';
  };

const variantToElement = {
  heading1: 'h1',
  body: 'p',
};

export function Typography(props: TypographyProps) {
  const { className, overrideEl, variant, ...rest } = props;

  const Element = variantToElement[overrideEl || variant || 'body'] || 'p';

  return React.createElement(Element, {
    className: cn(typographyVariants({ ...rest, variant, className })),
    ...rest,
  });
}
