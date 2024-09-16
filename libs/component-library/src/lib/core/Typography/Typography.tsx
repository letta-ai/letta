'use client';
import type { HTMLProps } from 'react';
import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@letta-web/core-style-config';

const typographyVariants = cva('break-words', {
  variants: {
    variant: {
      heading1: 'text-xl',
      heading2: 'text-lg',
      body: 'text-base',
      body2: 'text-sm',
    },
    color: {
      default: '',
      black: 'text-black',
      primary: 'text-primary',
      muted: 'text-muted',
      white: 'text-white',
      positive: 'text-positive',
      destructive: 'text-destructive',
    },
    bold: {
      true: 'font-medium',
    },
    noWrap: {
      true: 'whitespace-nowrap',
    },
    align: {
      center: 'text-center',
      left: 'text-left',
      right: 'text-right',
    },
    underline: {
      true: 'underline',
    },
    italic: {
      true: 'italic',
    },
  },
  defaultVariants: {
    variant: 'body',
    color: 'default',
  },
});

type TypographyProps = HTMLProps<HTMLElement> &
  VariantProps<typeof typographyVariants> & {
    overrideEl?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span';
  };

const variantToElement = {
  heading1: 'h1',
  heading2: 'h2',
  body: 'p',
  body2: 'p',
};

export function Typography(props: TypographyProps) {
  const { className, overrideEl, noWrap, variant, bold, ...rest } = props;

  const Element = overrideEl || variantToElement[variant || 'body'] || 'p';

  return React.createElement(Element, {
    className: cn(
      typographyVariants({ ...rest, noWrap, bold, variant, className })
    ),
    ...rest,
  });
}
