'use client';
import type { HTMLProps } from 'react';
import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@letta-web/core-style-config';

const typographyVariants = cva('break-words', {
  variants: {
    variant: {
      heading1: 'text-[1.8rem] font-semibold',
      heading2: 'text-[1.725rem] font-semibold',
      heading3: 'text-[1.5rem]',
      heading4: 'text-xl',
      heading5: 'text-lg',
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
    fullWidth: {
      true: 'w-full',
    },
    noWrap: {
      true: 'whitespace-nowrap',
    },
    overflow: {
      ellipsis: 'overflow-ellipsis overflow-hidden',
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
  heading3: 'h3',
  heading4: 'h4',
  heading5: 'h5',
  body: 'p',
  body2: 'p',
};

export function Typography(props: TypographyProps) {
  const {
    className,
    overrideEl,
    fullWidth,
    underline,
    italic,
    noWrap,
    variant,
    bold,
    ...rest
  } = props;

  const Element = overrideEl || variantToElement[variant || 'body'] || 'p';

  return React.createElement(Element, {
    className: cn(
      typographyVariants({
        ...rest,
        underline,
        italic,
        noWrap,
        bold,
        fullWidth,
        variant,
        className,
      })
    ),
    ...rest,
  });
}

interface LoadedTypographyProps extends TypographyProps {
  fillerText: string;
  text?: string;
  isLoading?: boolean;
}

export function LoadedTypography(props: LoadedTypographyProps) {
  const { fillerText, text, isLoading, ...rest } = props;

  return (
    <div className="relative">
      {!isLoading && text && (
        <Typography {...rest} className="absolute right-0 text-right left-0">
          {text}
        </Typography>
      )}
      <Typography
        {...rest}
        role="presentation"
        tabIndex={-1}
        className={cn(
          'pointer-events-none bg-gray-200 select-none  rounded text-transparent',
          !isLoading ? 'opacity-0' : 'animate-pulse'
        )}
      >
        {fillerText}
      </Typography>
    </div>
  );
}
