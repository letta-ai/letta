import type { HTMLProps } from 'react';
import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@letta-web/core-style-config';

const typographyVariants = cva('', {
  variants: {
    variant: {
      heading1: 'text-4xl font-medium',
      body: 'text-base font-normal',
    },
    color: {
      default: 'text-black',
      white: 'text-white',
    },
  },
  defaultVariants: {
    variant: 'body',
    color: 'default',
  },
});

type TypographyProps = HTMLProps<HTMLElement> &
  VariantProps<typeof typographyVariants>;

const variantToElement = {
  heading1: 'h1',
  body: 'p',
};

export function Typography(props: TypographyProps) {
  const { className, variant, ...rest } = props;

  const Element = variantToElement[variant || 'body'] || 'p';

  return React.createElement(Element, {
    className: cn(typographyVariants({ variant, className })),
    ...rest,
  });
}
